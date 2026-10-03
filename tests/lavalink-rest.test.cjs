const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { LavalinkRest } = require("../src/music/LavalinkRest");
test("Lavalink REST retains HTTP status and safe operation details for non-JSON proxy failures", async (t) => {
    const requests = [];
    const server = http.createServer((req, res) => {
        requests.push(req.method);
        if (req.url === "/v4/info") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ version: { semver: "4.0.0" } }));
        } else {
            res.writeHead(405, { "Content-Type": "text/html" });
            res.end("<html>private proxy response</html>");
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const rest = new LavalinkRest(
        { manager: { options: { userAgent: "test", restTimeout: 2 } }, sessionId: "private-session" },
        { url: `127.0.0.1:${server.address().port}`, secure: false, auth: "private-password" },
    );
    assert.equal((await rest.getLavalinkInfo()).version.semver, "4.0.0");
    await assert.rejects(rest.updateSession(true, 60), (e) => {
        assert.match(e.message, /PATCH session failed \(HTTP 405\)/);
        assert.doesNotMatch(e.message, /private|password|Authorization/);
        assert.equal(e.status, 405);
        return true;
    });
    assert.deepEqual(requests, ["GET", "PATCH"]);
});

test("only optional session-resume 403 falls back; player authorization failures remain errors", async (t) => {
    const requests = [];
    const events = [];
    const server = http.createServer((req, res) => {
        requests.push(req.url);
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end("denied");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const rest = new LavalinkRest(
        {
            name: "primary",
            manager: {
                options: { restTimeout: 2, resumeByLibrary: true },
                emit: (...args) => events.push(args),
            },
            sessionId: "private",
        },
        { url: `127.0.0.1:${server.address().port}`, auth: "synthetic" },
    );
    assert.deepEqual(await rest.updateSession(true, 60), { resuming: false, timeout: 0 });
    assert.deepEqual(await rest.updateSession(true, 60), { resuming: false, timeout: 0 });
    assert.equal(requests.length, 1);
    assert.deepEqual(events, [["resumeUnavailable", "primary"]]);
    await assert.rejects(
        rest.fetch({ endpoint: "/sessions/private/players/guild", options: { method: "PATCH" } }),
        /PATCH player failed \(HTTP 403\)/,
    );
    assert.equal(requests.length, 2);
});

test("node filter capabilities are loaded before saved player restoration", async () => {
    const { restoreNode } = require("../utils/music");
    const node = { info: null, rest: { getLavalinkInfo: async () => ({ filters: ["equalizer"] }) } };
    let restored = 0;
    const music = {
        lavalink: { nodes: new Map([["primary", node]]) },
        restorePlayers: async () => {
            assert.deepEqual(node.info.filters, ["equalizer"]);
            restored++;
        },
    };
    await restoreNode(music, "primary", {}, { getDB: () => ({ guilds: {} }) }, { warn() {} });
    assert.equal(restored, 1);
    music.closing = true;
    await restoreNode(music, "primary", {}, {}, {});
    assert.equal(restored, 1);
});
