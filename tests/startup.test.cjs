const test = require("node:test");
const assert = require("node:assert/strict");
const { missingConfiguration, createSetupServer } = require("../scripts/start");
const { load } = require("./helpers.cjs");

test("startup configuration requires production storage and optional web credentials", () => {
    const bot = { DISCORD_TOKEN: "synthetic", CLIENT_ID: "synthetic", OWNER_IDS: "synthetic" };
    assert.deepEqual(missingConfiguration(bot), []);
    assert.deepEqual(missingConfiguration({ ...bot, NODE_ENV: "production" }), [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    const web = {
        ...bot,
        DATABASE_BACKEND: "supabase",
        SUPABASE_URL: "synthetic",
        SUPABASE_SERVICE_ROLE_KEY: "synthetic",
        WEB_ENABLED: "true",
        WEB_URL: "https://example.test",
        DISCORD_CLIENT_SECRET: "synthetic",
        SESSION_SECRET: "too-short",
    };
    assert.deepEqual(missingConfiguration(web), ["SESSION_SECRET"]);
    assert.deepEqual(missingConfiguration({ ...web, SESSION_SECRET: "s".repeat(32) }), []);
});

test("configuration server serves public assets, denies application writes and never reports bot readiness", async (t) => {
    const server = createSetupServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(`${url}/app.js`)).status, 200);
    const configResponse = await fetch(`${url}/api/config`);
    assert.match(configResponse.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.deepEqual(await configResponse.json(), {
        setupRequired: true,
        oauthConfigured: false,
        botOnline: false,
        storage: "not_initialized",
        version: "V4+++ preview",
    });
    for (const route of ["/health", "/api/health", "/ready"]) {
        const response = await fetch(url + route);
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.status, "configuration_required");
        assert.equal(body.database, false);
        assert.equal(body.bot, false);
    }
    for (const route of ["/.env", "/database/database.json", "/api/auth/login", "/api/guilds"])
        assert.equal((await fetch(url + route)).status, 404);
    assert.equal((await fetch(`${url}/api/user`)).status, 401);
    assert.equal(
        (await fetch(`${url}/api/guilds/111111111111111111/settings`, { method: "PATCH", body: "{}" }))
            .status,
        405,
    );
    assert.equal(
        Object.keys(require.cache).some((name) => name.endsWith("/utils/database.js")),
        false,
    );
});

test("launcher fails closed by default and delegates to the bot only with complete required configuration", () => {
    const runtime = { env: {}, loadEnvFile() {}, exitCode: 0 };
    const launcher = load(
        "scripts/start.js",
        { "../index.js": () => {} },
        { process: runtime, console: { error() {}, warn() {} } },
    );
    assert.equal(launcher.start(), undefined);
    assert.equal(runtime.exitCode, 1);
    runtime.env = { DISCORD_TOKEN: "synthetic", CLIENT_ID: "synthetic", OWNER_IDS: "synthetic" };
    const application = { initialized: true };
    const ready = load("scripts/start.js", { "../index.js": application }, { process: runtime });
    assert.equal(ready.start(), application);
});

test("opt-in migration must finish before bot load and failure prevents Discord startup", async () => {
    let finish;
    let loads = 0;
    const runtime = {
        env: {
            DISCORD_TOKEN: "synthetic",
            CLIENT_ID: "synthetic",
            OWNER_IDS: "synthetic",
            DATABASE_BACKEND: "supabase",
            SUPABASE_URL: "synthetic",
            SUPABASE_SERVICE_ROLE_KEY: "synthetic",
            MIGRATE_LEGACY_ON_START: "true",
        },
        loadEnvFile() {},
    };
    const overrides = {
        "../database/migration/bootstrap": {
            bootstrap: () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        },
        get "../index.js"() {
            loads++;
            return "application";
        },
    };
    const launcher = load("scripts/start.js", overrides, { process: runtime, console: { info() {} } });
    const pending = launcher.start();
    assert.equal(loads, 0);
    finish({ status: "migrated", verified: true });
    assert.equal(await pending, "application");
    assert.equal(loads, 1);
    overrides["../database/migration/bootstrap"] = {
        bootstrap: async () => {
            throw new Error("verification failed");
        },
    };
    await assert.rejects(launcher.start(), /verification failed/);
    assert.equal(loads, 1);
    runtime.env.DATABASE_BACKEND = "legacy";
    assert.throws(() => launcher.start(), /requires DATABASE_BACKEND=supabase/);
});
