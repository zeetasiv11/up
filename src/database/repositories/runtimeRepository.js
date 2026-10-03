const { isDeepStrictEqual } = require("node:util");
const { randomUUID } = require("node:crypto");
const { databaseClient } = require("../client");
const { databaseError } = require("../databaseError");
const tables = require("../runtimeTables.json");
const { normalizeLegacy } = require("../../../database/migration/normalizeLegacy");
const project = (row, columns) => Object.fromEntries(columns.map((key) => [key, row[key]]));
function diffRows(before, after) {
    const changes = {};
    for (const [table, { keys, columns }] of Object.entries(tables)) {
        const key = (row) => JSON.stringify(keys.map((field) => row[field]));
        const oldRows = new Map((before[table] || []).map((row) => [key(row), project(row, columns)]));
        const upserts = [];
        for (const row of after[table] || []) {
            const prior = oldRows.get(key(row));
            const next = project(row, columns);
            oldRows.delete(key(row));
            if (!isDeepStrictEqual(prior, next)) upserts.push({ before: prior || null, after: next });
        }
        if (upserts.length || oldRows.size) changes[table] = { upserts, deletes: [...oldRows.values()] };
    }
    return changes;
}
function hydrate({ rows, original }) {
    // Full profile/settings JSONB retains unknown legacy fields; normalized economy
    // columns override archived balances. No file is read in Supabase mode.
    const source = structuredClone(original);
    source.guilds = Object.fromEntries(rows.guild_settings.map((row) => [row.guild_id, row.data]));
    source.users = Object.fromEntries(rows.user_profiles.map((row) => [row.user_id, row.data]));
    for (const row of rows.user_economy)
        Object.assign(source.users[row.user_id], row.data, {
            balance: Number(row.balance),
            bank: Number(row.bank),
        });
    source.warnings = {};
    for (const row of [...rows.warnings].sort(
        (a, b) => Number(a.id.split(":").at(-1)) - Number(b.id.split(":").at(-1)),
    ))
        (source.warnings[`${row.guild_id}-${row.user_id}`] ||= []).push(row.data);
    source.tickets = Object.fromEntries(rows.tickets.map((row) => [row.id, row.data]));
    source.reminders = rows.reminders.map((row) => row.data);
    source.afk = Object.fromEntries(rows.afk_users.map((row) => [row.user_id, row.data]));
    source.blacklist = rows.blacklist.map((row) => row.user_id);
    source.stats = rows.bot_statistics.find((row) => row.id === "global")?.data || {};
    source.lottery = rows.lottery_rounds.sort((a, b) => String(b.id).localeCompare(String(a.id)))[0]
        ?.data || { date: "", pot: 0, tickets: {}, lastWinnerId: "", lastPot: 0 };
    return structuredClone(source);
}
class RuntimeRepository {
    constructor(client = databaseClient()) {
        this.client = client;
        this.instance = randomUUID();
        this.failure = null;
        this.closed = false;
    }
    async rpc(name, args) {
        const { data, error, status } = await this.client.rpc(name, args);
        if (error) throw databaseError(name, error, status);
        return data;
    }
    async initialize() {
        const loaded = await this.rpc("runtime_load", { instance: this.instance });
        this.revision = loaded.revision;
        this.rows = loaded.rows;
        this.leaseUntil = Date.now() + 75000;
        this.timer = setInterval(() => {
            this.renewal = this.renew().catch((error) => {
                this.failure = error;
            });
        }, 20000);
        this.timer.unref();
        return hydrate(loaded);
    }
    assertHealthy() {
        if (this.failure || this.closed || Date.now() > this.leaseUntil)
            throw new Error("Database is unavailable; commands are paused until a safe restart.", {
                cause: this.failure,
            });
    }
    async renew() {
        this.assertHealthy();
        await this.rpc("runtime_lease", { instance: this.instance });
        this.leaseUntil = Date.now() + 75000;
    }
    async persist(snapshot, actor = "bot") {
        this.assertHealthy();
        try {
            const next = normalizeLegacy(snapshot).rows;
            const changes = diffRows(this.rows, next);
            if (!Object.keys(changes).length) return;
            const args = {
                instance: this.instance,
                expected_revision: this.revision,
                operation: randomUUID(),
                changes,
                actor,
            };
            // Same operation ID makes an ambiguous network result safe to retry.
            let revision;
            try {
                revision = await this.rpc("runtime_commit", args);
            } catch {
                revision = await this.rpc("runtime_commit", args);
            }
            this.revision = revision;
            this.rows = next;
            this.leaseUntil = Date.now() + 75000;
        } catch (error) {
            this.failure = error;
            throw error;
        }
    }
    async close() {
        clearInterval(this.timer);
        this.closed = true;
        await this.renewal;
        await this.rpc("runtime_lease", { instance: this.instance, release: true });
    }
}
module.exports = { RuntimeRepository, diffRows, hydrate };
