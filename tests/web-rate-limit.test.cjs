const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuth } = require("../web/backend/auth");
const { createDashboard } = require("../web/backend/server");
const guildId = "123456789012345678";
const reply = (status, data, headers = {}) => ({
    status, ok: status >= 200 && status < 300,
    headers: new Headers(headers), json: async () => data,
});

test("concurrent guild authorization shares retries and honors reset without caching revoked access", async () => {
    let time = 0, calls = 0, managed = true;
    const delays = [], session = { token: "synthetic" };
    const auth = createAuth({
        env: {}, now: () => time,
        wait: async (ms) => { delays.push(ms); time += ms; },
        request: async () => {
            calls++;
            if (calls === 1) return reply(429, { retry_after: 1 }, { "Retry-After": "1" });
            return reply(200, managed ? [{ id: guildId, permissions: "32" }] : [], {
                "X-RateLimit-Remaining": "0", "X-RateLimit-Reset-After": "2",
            });
        },
    });
    const values = await Promise.all([auth.authorize(session, guildId), auth.authorize(session, guildId)]);
    assert.equal(values.length, 2);
    assert.equal(calls, 2);
    assert.deepEqual(delays, [1000]);
    managed = false;
    await assert.rejects(auth.authorize(session, guildId), { status: 403 });
    assert.equal(calls, 3);
    assert.deepEqual(delays, [1000, 2000]);
    auth.close();
});

test("long Discord cooldown fails closed and repeated retries are bounded", async () => {
    for (const seconds of [1, 120]) {
        let calls = 0, time = 0;
        const auth = createAuth({
            env: {}, now: () => time, wait: async (ms) => { time += ms; },
            request: async () => { calls++; return reply(429, { retry_after: seconds }); },
        });
        await assert.rejects(auth.guilds({ token: "synthetic" }), (error) => {
            assert.equal(error.status, 429);
            assert.equal(error.retryAfter, seconds);
            assert.doesNotMatch(error.message, /synthetic/);
            return true;
        });
        assert.equal(calls, seconds === 1 ? 3 : 1);
        assert.ok(time <= 8000);
    }
});

test("rate limiting cannot grant access and dashboard forwards Retry-After", async (t) => {
    const auth = {
        configured: true,
        session: () => { throw Object.assign(new Error("Wait for Discord"), { status: 429, retryAfter: 2 }); },
        close() {},
    };
    const server = createDashboard({ auth, db: {}, env: {} });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api/guilds/${guildId}/settings`);
    assert.equal(result.status, 429);
    assert.equal(result.headers.get("retry-after"), "2");
});
