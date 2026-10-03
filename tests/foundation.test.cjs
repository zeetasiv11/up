const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { load, silent } = require("./helpers.cjs");

test("corrupt legacy JSON fails without replacing the original", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zeechei-db-"));
    const file = path.join(directory, "database.json");
    try {
        await fs.writeFile(file, "{broken");
        const db = load("utils/database.js", {}, { process: { env: { LEGACY_DATABASE_PATH: file } } });
        assert.throws(() => db.getUser("test"), /File dipertahankan/);
        assert.equal(await fs.readFile(file, "utf8"), "{broken");
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test("persistence failure rejects and a later save can recover", async () => {
    let fail = true;
    const fake = {
        existsSync: () => true,
        readFileSync: () => '{"users":{},"guilds":{},"blacklist":[]}',
        promises: {
            writeFile: async () => {
                if (fail) throw Error("disk full");
            },
            rename: async () => {},
        },
    };
    const db = load("utils/database.js", { fs: fake }, { console: silent });
    await assert.rejects(db.save(), /disk full/);
    fail = false;
    await db.save();
    await db.flush();
});

test("Mines concurrent cashouts produce one settlement; rejected second action does not pay", async () => {
    const users = { test: { balance: 1000 } };
    const db = {
        getUser: (id) => (users[id] ||= { balance: 1000 }),
        updateUser: (id, data) => Object.assign(users[id], data),
        save: async () => {},
        flush: async () => {},
    };
    const sessions = load("services/game/sessionManager.js", { "../../utils/database": db });
    const session = sessions.createSession(
        "mines",
        "test",
        {
            size: 16,
            mines: new Set([0, 1, 2, 3]),
            mineCount: 4,
            revealed: new Set([4]),
            bet: 100,
            safeOpened: 1,
            lastIndex: 4,
        },
        60000,
    );
    let payouts = 0,
        denied = 0;
    const controller = load("services/game/controllers/minesController.js", {
        "../../economy/economyService.js": {
            addBalance() {
                payouts++;
            },
        },
        "../../economy/statsService.js": { recordGameResult() {} },
        "../sessionManager.js": sessions,
        "../../../utils/logger.js": silent,
    });
    const interaction = {
        user: { id: "test" },
        update: async () => {},
        reply: async () => {
            denied++;
        },
    };
    try {
        await Promise.all([
            controller.handleButton(interaction, "cashout", session.id),
            controller.handleButton(interaction, "cashout", session.id),
        ]);
        assert.equal(payouts, 1);
        assert.equal(denied, 1);
        assert.equal(sessions.getSession(session.id), null);
    } finally {
        sessions.endSession(session.id);
    }
});

test("action failure releases ownership and timeout waits for an active action", async () => {
    const timers = [];
    const user = { balance: 1000 };
    const db = {
        getUser: () => user,
        updateUser: (id, data) => Object.assign(user, data),
        save: async () => {},
        flush: async () => {},
    };
    const sessions = load(
        "services/game/sessionManager.js",
        { "../../utils/database": db },
        {
            setTimeout: (fn) => {
                timers.push(fn);
                return timers.length;
            },
            clearTimeout() {},
        },
    );
    let expired = 0;
    const s = sessions.createSession("test", "owner", {}, 100, async () => {
        expired++;
    });
    let release;
    const pending = sessions.withAction(
        s.id,
        "owner",
        () =>
            new Promise((resolve) => {
                release = resolve;
            }),
    );
    await timers[0]();
    assert.equal(expired, 0);
    release();
    await pending;
    await timers[1]();
    assert.equal(expired, 1);
    assert.equal(sessions.getSession(s.id), null);
    const retry = sessions.createSession("test", "owner", {}, 100);
    await assert.rejects(
        sessions.withAction(retry.id, "owner", async () => {
            throw Error("network");
        }),
        /network/,
    );
    assert.equal(await sessions.withAction(retry.id, "owner", async () => {}), true);
    sessions.endSession(retry.id);
});

test("prefix checks the common policy before executing its handler", async () => {
    const handler = load("handlers/prefixCommandHandler.js", {
        "../utils/logger.js": silent,
        "../utils/database": { getGuild: () => ({}) },
        "../src/bot/middleware/accessPolicy.js": { accessError: () => "Blocked" },
    });
    handler.loadPrefixCommands();
    let executed = false,
        replies = 0;
    handler.getRegistry().set("choose", {
        category: "fun",
        execute: async () => {
            executed = true;
        },
    });
    const handled = await handler.handlePrefixMessage({
        author: { bot: false, id: "blocked" },
        guild: { id: "guild" },
        content: "zchoose a | b",
        reply: async () => {
            replies++;
        },
    });
    assert.equal(handled, true);
    assert.equal(executed, false);
    assert.equal(replies, 1);
});

test("common reward service shares cooldown and preserves streak/quest progress", () => {
    const user = { balance: 0, lastDaily: 0, lastWork: 0, dailyStreak: 0 };
    let progress = 0;
    const rewards = load("services/economy/rewardService.js", {
        "../../utils/database.js": {
            getUser: () => user,
            updateUser: (id, patch) => Object.assign(user, patch),
        },
        "../quest/questService.js": {
            progressQuest: (id, type, n) => {
                progress += n;
            },
        },
    });
    const now = Date.now();
    assert.equal(rewards.claim("test", "daily", now).amount, 50000);
    assert.equal(rewards.claim("test", "daily", now).ok, false);
    assert.equal(rewards.claim("test", "daily", now + 86400000).streak, 2);
    assert.equal(user.balance, 100200);
    assert.equal(progress, 100200);
});

test("shared policy applies blacklist and maintenance with explicit owner exception", () => {
    const settings = { maintenance: { enabled: false, message: "maintenance" } };
    let blacklist = true,
        guildMaintenance = false;
    const policy = load("src/bot/middleware/accessPolicy.js", {
        "../../../settings.js": settings,
        "../../../utils/database.js": {
            isBlacklisted: () => blacklist,
            getGuild: () => ({ maintenance: guildMaintenance }),
        },
        "../../../utils/permissions.js": { isOwner: (id) => id === "owner" },
    });
    assert.equal(policy.accessError("owner", "guild"), null);
    assert.match(policy.accessError("user", "guild"), /blacklist/);
    blacklist = false;
    settings.maintenance.enabled = true;
    assert.equal(policy.accessError("user", "guild"), "maintenance");
    settings.maintenance.enabled = false;
    guildMaintenance = true;
    assert.match(policy.accessError("user", "guild"), /maintenance/);
});

test("legacy transfer commits both accounts in one snapshot and rejects invalid amounts/overflow", () => {
    const users = { a: { balance: 100, bank: 20 }, b: { balance: 0, bank: 0 } };
    let saves = 0;
    const economy = load("services/economy/economyService.js", {
        "../../utils/logger.js": silent,
        "../../utils/database.js": {
            getUser: (id) => users[id],
            updateUsers: (patches) => {
                saves++;
                for (const [id, patch] of Object.entries(patches)) Object.assign(users[id], patch);
            },
            updateUser: (id, patch) => {
                saves++;
                Object.assign(users[id], patch);
            },
        },
    });
    assert.equal(economy.transfer("a", "b", 25).ok, true);
    assert.equal(saves, 1);
    assert.equal(users.a.balance, 75);
    assert.equal(users.b.balance, 25);
    for (const amount of [-1, 0, NaN, Infinity, 1.5]) {
        assert.equal(economy.deposit("a", amount).ok, false);
        assert.equal(economy.withdraw("a", amount).ok, false);
        assert.equal(economy.transfer("a", "b", amount).ok, false);
    }
    users.b.balance = Number.MAX_SAFE_INTEGER;
    assert.equal(economy.transfer("a", "b", 1).ok, false);
    assert.equal(users.a.balance, 75);
});

test("guild service validates patch and preserves unrelated legacy settings", async () => {
    const { createGuildConfigService } = require("../src/database/services/guildConfigService.js");
    let saved;
    const service = createGuildConfigService({
        get: async () => ({ data: { musicMode247: true }, version: 4 }),
        update: async (...args) => {
            saved = args;
            return { version: 5 };
        },
    });
    const id = "111111111111111111";
    await assert.rejects(service.update(id, { token: "forbidden" }, 4, id));
    await assert.rejects(service.update(id, { prefix: "!" }, 3, id), /reload/);
    await service.update(id, { prefix: "!" }, 4, id);
    assert.deepEqual(saved[1], { musicMode247: true, prefix: "!" });
});

test("event reload preserves listeners owned by music and avoids duplicate handlers", () => {
    const { EventEmitter } = require("node:events");
    const { loadEvents } = require("../handlers/eventHandler.js");
    const client = new EventEmitter(),
        musicListener = () => {};
    client.on("messageDelete", musicListener);
    loadEvents(client);
    loadEvents(client);
    assert.equal(client.loadedEventHandlers.length, 9);
    assert.equal(client.listenerCount("messageDelete"), 2);
    assert.ok(client.listeners("messageDelete").includes(musicListener));
});

test("game escrow and saved session share one write; restoring a game never deducts the bet twice", async () => {
    const users = { player: { balance: 1000 } };
    const writes = [];
    const timers = [];
    const db = {
        getUser: (id) => users[id],
        getDB: () => ({ users }),
        updateUser: (id, patch) => {
            Object.assign(users[id], patch);
            writes.push(structuredClone(users));
        },
        save: async () => {
            writes.push(structuredClone(users));
        },
        flush: async () => {},
    };
    const globals = {
        setTimeout: (fn) => {
            timers.push(fn);
            return { unref() {} };
        },
        clearTimeout() {},
    };
    const manager = load("services/game/sessionManager.js", { "../../utils/database": db }, globals);
    const session = manager.createSession(
        "mines",
        "player",
        { bet: 100, mines: new Set([1, 2]), revealed: new Set([3]) },
        60000,
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].player.balance, 900);
    assert.ok(writes[0].player.activeGames[session.id]);
    assert.equal(manager.createSession("mines", "player", { bet: 100 }, 60000), null);
    assert.equal(users.player.balance, 900);
    const restarted = load(
        "services/game/sessionManager.js",
        { "../../utils/database": db, "./controllers/minesController": { onTimeout: async () => {} } },
        globals,
    );
    await restarted.restore({ channels: { fetch: async () => null } });
    assert.equal(users.player.balance, 900);
    const restored = restarted.getSession(session.id);
    assert.ok(restored.data.mines.has(1));
    assert.ok(restored.data.revealed.has(3));
    restarted.endSession(session.id);
    users.player.balance += 125;
    await Promise.resolve();
    assert.equal(writes.at(-1).player.balance, 1025);
    assert.deepEqual(Object.keys(writes.at(-1).player.activeGames), []);
});
