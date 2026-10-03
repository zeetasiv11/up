const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeWithHandoff, createHandoffServer } = require("../src/database/runtimeHandoff");
const held = () =>
    new Error("Database runtime_load failed", {
        cause: { message: "Another bot instance owns the runtime lease" },
    });
const logger = { info() {} };
test("handover exposes liveness only while waiting, then closes listener before returning initialized state", async () => {
    let attempts = 0,
        closed = false,
        origin;
    const result = await initializeWithHandoff({
        env: { RUNTIME_HANDOFF: "true" },
        logger,
        initialize: async () => {
            if (++attempts === 1) throw held();
            return { latestSnapshot: true };
        },
        open: async () => {
            const server = createHandoffServer();
            await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
            origin = `http://127.0.0.1:${server.address().port}`;
            return async () => {
                await new Promise((resolve) => server.close(resolve));
                closed = true;
            };
        },
        delay: async () => {
            assert.equal(attempts, 1);
            assert.equal(closed, false);
            assert.equal((await fetch(origin)).status, 200);
            for (const route of ["/ready", "/health", "/api/user"]) {
                const response = await fetch(origin + route);
                assert.equal(response.status, 503);
                assert.equal((await response.json()).database, false);
            }
            assert.equal((await fetch(origin, { method: "POST" })).status, 503);
        },
    });
    assert.deepEqual(result, { latestSnapshot: true });
    assert.equal(attempts, 2);
    assert.equal(closed, true);
});
test("handover never retries other errors or acquires a lease by force, and cleans up on failure", async () => {
    let opened = 0,
        closed = 0,
        attempts = 0;
    const options = {
        logger,
        env: { RUNTIME_HANDOFF: "true" },
        open: async () => {
            opened++;
            return async () => {
                closed++;
            };
        },
        delay: async () => {},
    };
    await assert.rejects(
        initializeWithHandoff({
            ...options,
            initialize: async () => {
                throw new Error("bad credentials");
            },
        }),
        /bad credentials/,
    );
    await assert.rejects(
        initializeWithHandoff({
            ...options,
            env: {},
            initialize: async () => {
                throw held();
            },
        }),
        /runtime_load/,
    );
    await assert.rejects(
        initializeWithHandoff({
            ...options,
            timeoutMs: 0,
            initialize: async () => {
                throw held();
            },
        }),
        /runtime_load/,
    );
    assert.equal(opened, 0);
    await assert.rejects(
        initializeWithHandoff({
            ...options,
            initialize: async () => {
                if (++attempts === 1) throw held();
                throw new Error("database unavailable");
            },
        }),
        /database unavailable/,
    );
    assert.equal(opened, 1);
    assert.equal(closed, 1);
});
