const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { PGlite } = require("@electric-sql/pglite");
const { normalizeLegacy, hash } = require("../database/migration/normalizeLegacy.js");
const { backupLegacy } = require("../database/migration/backupLegacy.js");
const { run } = require("../database/migration/migrateLegacy.js");
const A = "111111111111111111",
    B = "222222222222222222",
    G = "333333333333333333";
const source = () => ({
    guilds: { [G]: { welcomeChannel: "", musicHistory: [] } },
    users: {
        [A]: {
            balance: 1000,
            bank: 100,
            inventory: { food: 2 },
            animals: [{ instanceId: "a", animalId: "cat" }],
            quests: { list: [], date: "" },
            unknownLegacyField: "retained",
        },
        [B]: { balance: 100, bank: 0 },
    },
    blacklist: [],
    warnings: {},
    stats: { commandsUsed: 2 },
});

test("validation rejects invalid amounts and duplicate animal IDs before import", () => {
    const data = source();
    data.users[A].balance = -1;
    assert.throws(() => normalizeLegacy(data), /balance/);
    data.users[A].balance = 1;
    data.users[A].animals.push({ instanceId: "a" });
    assert.throws(() => normalizeLegacy(data), /duplicate/);
    assert.throws(() => normalizeLegacy(JSON.parse('{"users":{},"guilds":{},"__proto__":{}}')), /reserved/);
});

test("dry-run backs up exact bytes, generates counts, and needs no database", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zeechei-migration-"));
    try {
        const file = path.join(directory, "source.json"),
            backups = path.join(directory, "backups");
        const bytes = JSON.stringify(source(), null, 2);
        await fs.writeFile(file, bytes);
        const result = await run({ source: file, directory: backups, dryRun: true });
        assert.equal(result.report.counts.users, 2);
        assert.equal(await fs.readFile(result.report.backup, "utf8"), bytes);
        assert.equal((await backupLegacy(file, backups)).digest, hash(bytes));
        await fs.writeFile(result.report.backup, "tampered");
        await assert.rejects(backupLegacy(file, backups), /checksum/);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test("actual PostgreSQL schema: atomic migration, idempotence, RLS, transfer ledger and optimistic settings", async () => {
    const pg = new PGlite();
    try {
        await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
        await pg.exec(await fs.readFile(path.join(__dirname, "../database/supabase/schema.sql"), "utf8"));
        const original = source(),
            payload = normalizeLegacy(original).rows,
            digest = hash(JSON.stringify(original));
        const imported = await pg.query("select public.import_legacy($1, $2::jsonb, $3::jsonb) as result", [
            digest,
            JSON.stringify(payload),
            JSON.stringify(original),
        ]);
        assert.equal(imported.rows[0].result.alreadyImported, false);
        const again = await pg.query("select public.import_legacy($1, $2::jsonb, $3::jsonb) as result", [
            digest,
            JSON.stringify(payload),
            JSON.stringify(original),
        ]);
        assert.equal(again.rows[0].result.alreadyImported, true);
        assert.equal((await pg.query("select count(*)::int as n from users")).rows[0].n, 2);
        const saved = (await pg.query("select original from legacy_imports")).rows[0].original;
        assert.equal(saved.users[A].unknownLegacyField, "retained");
        // A conflicting import rolls back the guild inserted earlier in the transaction.
        const conflicting = source();
        conflicting.guilds = { "444444444444444444": {} };
        await assert.rejects(
            pg.query("select import_legacy($1,$2::jsonb,$3::jsonb)", [
                hash("conflict"),
                JSON.stringify(normalizeLegacy(conflicting).rows),
                JSON.stringify(conflicting),
            ]),
            /duplicate/,
        );
        assert.equal((await pg.query("select count(*)::int as n from guilds")).rows[0].n, 1);
        await pg.query("select transfer_balance($1,$2,$3,$4)", ["transfer-1", A, B, 250]);
        await pg.query("select transfer_balance($1,$2,$3,$4)", ["transfer-1", A, B, 250]);
        assert.equal(
            (await pg.query("select balance from user_economy where user_id=$1", [A])).rows[0].balance,
            750,
        );
        assert.equal((await pg.query("select count(*)::int n from economy_transactions")).rows[0].n, 1);
        await assert.rejects(
            pg.query("select transfer_balance($1,$2,$3,$4)", ["transfer-1", A, B, 251]),
            /different transfer/,
        );
        await assert.rejects(
            pg.query("select transfer_balance($1,$2,$3,$4)", ["overdraft", A, B, 900]),
            /Insufficient/,
        );
        assert.equal((await pg.query("select count(*)::int n from economy_operations")).rows[0].n, 1);
        await pg.query("select update_guild_settings($1,$2,$3::jsonb,$4)", [G, 0, '{"prefix":"!"}', A]);
        await assert.rejects(
            pg.query("select update_guild_settings($1,$2,$3::jsonb,$4)", [G, 0, "{}", A]),
            /reload/,
        );
        await pg.exec("set role anon");
        await assert.rejects(pg.query("select * from user_economy"), /permission denied/);
        await assert.rejects(
            pg.query("select transfer_balance($1,$2,$3,$4)", ["denied", A, B, 1]),
            /permission denied/,
        );
        await pg.exec("reset role; set role service_role");
        assert.equal((await pg.query("select count(*)::int n from users")).rows[0].n, 2);
        await pg.exec("reset role");
    } finally {
        await pg.close();
    }
});

test("failed dry-run retains malformed source and creates a failure report", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zeechei-invalid-"));
    try {
        const source = path.join(directory, "database.json"),
            backups = path.join(directory, "backups");
        await fs.writeFile(source, "{broken");
        await assert.rejects(run({ source, directory: backups, dryRun: true }), /invalid/);
        const reports = (await fs.readdir(backups)).filter((file) => file.startsWith("report-"));
        assert.equal(reports.length, 1);
        const report = JSON.parse(await fs.readFile(path.join(backups, reports[0]), "utf8"));
        assert.equal(report.status, "failed");
        assert.equal(report.failedAt, "validating");
        assert.equal(await fs.readFile(source, "utf8"), "{broken");
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
