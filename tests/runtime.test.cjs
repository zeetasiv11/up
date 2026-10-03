const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { randomUUID } = require("node:crypto");
const { RuntimeRepository, diffRows } = require("../src/database/repositories/runtimeRepository");
const { normalizeLegacy, hash } = require("../database/migration/normalizeLegacy");
const A = "111111111111111111",
    B = "222222222222222222",
    G = "333333333333333333";
test("Supabase runtime persists every normalized collection atomically, restores after restart and rejects a second writer", async () => {
    const pg = new PGlite();
    const repos = [];
    try {
        await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;");
        await pg.exec(await fs.readFile(path.join(__dirname, "../database/supabase/schema.sql"), "utf8"));
        await pg.exec(await fs.readFile(path.join(__dirname, "../database/supabase/runtime.sql"), "utf8"));
        const source = {
            users: {
                [A]: {
                    balance: 100,
                    bank: 20,
                    inventory: { food: 2 },
                    animals: [{ instanceId: "cat", animalId: "cat" }],
                    quests: { list: [] },
                    favoriteSongs: [],
                    playlists: {},
                },
                [B]: { balance: 0, bank: 0 },
            },
            guilds: { [G]: { musicHistory: [] } },
            blacklist: [],
            warnings: {},
            tickets: {},
            reminders: [],
            afk: {},
            stats: { commandsUsed: 0 },
            lottery: { date: "2026-10-02", pot: 0, tickets: {} },
        };
        await pg.query("select import_legacy($1,$2::jsonb,$3::jsonb)", [
            hash(JSON.stringify(source)),
            JSON.stringify(normalizeLegacy(source).rows),
            JSON.stringify(source),
        ]);
        const client = {
            rpc: async (name, args) => {
                try {
                    const entries = Object.entries(args);
                    const params = entries.map(([key], i) => `${key} => $${i + 1}`).join(",");
                    const result = await pg.query(
                        `select ${name}(${params}) as result`,
                        entries.map(([, v]) => (typeof v === "object" ? JSON.stringify(v) : v)),
                    );
                    return { data: result.rows[0].result, error: null };
                } catch (error) {
                    return { data: null, error };
                }
            },
        };
        const first = new RuntimeRepository(client);
        repos.push(first);
        const data = await first.initialize();
        const other = new RuntimeRepository(client);
        await assert.rejects(other.initialize(), /runtime_load/);
        data.users[A].balance -= 30;
        data.users[B].balance += 30;
        data.users[A].favoriteSongs.push({ name: "Track", url: "https://example.com/song" });
        data.users[A].inventory.food = 1;
        data.guilds[G].prefix = "!";
        data.blacklist.push(B);
        data.tickets["ticket-1"] = { guildId: G, ownerId: A };
        await first.persist(data);
        assert.equal(
            (await pg.query("select balance from user_economy where user_id=$1", [B])).rows[0].balance,
            30,
        );
        assert.equal((await pg.query("select count(*)::int n from user_music_favorites")).rows[0].n, 1);
        assert.equal((await pg.query("select count(*)::int n from audit_logs")).rows[0].n, 4);
        const version = first.revision;
        await first.persist(data);
        assert.equal(first.revision, version);
        await first.close();
        repos.splice(0, 1);
        const second = new RuntimeRepository(client);
        repos.push(second);
        const restored = await second.initialize();
        assert.equal(restored.users[B].balance, 30);
        assert.equal(restored.users[A].inventory.food, 1);
        assert.equal(restored.guilds[G].prefix, "!");
        assert.deepEqual(restored.blacklist, [B]);
        const changes = diffRows(
                second.rows,
                normalizeLegacy({ ...restored, stats: { commandsUsed: 1 } }).rows,
            ),
            operation = randomUUID();
        const args = { instance: second.instance, expected_revision: second.revision, operation, changes };
        const committed = await second.rpc("runtime_commit", args);
        assert.equal(await second.rpc("runtime_commit", args), committed);
        await assert.rejects(
            second.rpc("runtime_commit", { ...args, changes: { blacklist: { deletes: [{ user_id: B }] } } }),
            /runtime_commit/,
        );
        // A failed commit rolls back all affected accounts and freezes the stale cache.
        restored.users[A].balance -= 10;
        restored.users[B].balance += 10;
        await assert.rejects(second.persist(restored), /runtime_commit/);
        assert.throws(() => second.assertHealthy(), /paused/);
        assert.equal(
            (await pg.query("select balance from user_economy where user_id=$1", [A])).rows[0].balance,
            70,
        );
        await pg.exec("set role anon");
        await assert.rejects(pg.query("select runtime_load($1)", [randomUUID()]), /permission denied/);
        await pg.exec("reset role");
    } finally {
        for (const repo of repos) await repo.close().catch(() => {});
        await pg.close();
    }
});
