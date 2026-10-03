// Each test worker has disposable legacy storage, even if a dependency was not mocked.
const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zeechei-test-worker-"));
const file = path.join(directory, "database.json");
fs.writeFileSync(
    file,
    JSON.stringify({
        guilds: {},
        users: {},
        blacklist: [],
        warnings: {},
        tickets: {},
        reminders: [],
        afk: {},
        stats: {},
        lottery: { date: "", pot: 0, tickets: {} },
    }),
    { mode: 0o600 },
);
process.env.LEGACY_DATABASE_PATH = file;
process.env.DATABASE_BACKEND = "legacy";
process.env.NODE_ENV = "test";
process.once("exit", () => fs.rmSync(directory, { recursive: true, force: true }));
