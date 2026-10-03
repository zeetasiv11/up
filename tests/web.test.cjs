const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuth } = require("../web/backend/auth");
const { createDashboard } = require("../web/backend/server");
const { createSettingsService } = require("../web/backend/settings");
const { control } = require("../web/backend/music");
const { buildPayload, expand } = require("../src/services/welcome/greetingService");
const gid = "111111111111111111",
    uid = "222222222222222222";
const env = {
    WEB_URL: "http://localhost:3000",
    CLIENT_ID: gid,
    DISCORD_CLIENT_SECRET: "synthetic",
    SESSION_SECRET: "synthetic-testing-only-long-session-secret",
    NODE_ENV: "test",
};
function response() {
    return {
        headers: {},
        writeHead(status, headers) {
            this.status = status;
            Object.assign(this.headers, headers);
        },
        end() {},
        setHeader(key, value) {
            this.headers[key] = value;
        },
    };
}
test("OAuth binds state to signed browser cookie, rotates session and rejects replay / revoked permissions", async () => {
    let managed = true;
    const auth = createAuth({
        env,
        request: async (url) => ({
            ok: true,
            json: async () =>
                url.endsWith("/oauth2/token")
                    ? { access_token: "synthetic", scope: "identify guilds", expires_in: 600 }
                    : url.endsWith("/guilds")
                      ? managed
                          ? [{ id: gid, permissions: "32" }]
                          : []
                      : { id: uid, username: "tester" },
        }),
    });
    const login = response();
    auth.login(login);
    const location = new URL(login.headers.Location);
    const state = location.searchParams.get("state");
    const req = { headers: { cookie: login.headers["Set-Cookie"].split(";")[0] } };
    const callback = new URL(`http://localhost:3000/api/auth/callback?state=${state}&code=synthetic`);
    await assert.rejects(auth.callback({ headers: {} }, response(), callback), { status: 400 });
    const result = response();
    await auth.callback(req, result, callback);
    assert.equal(result.status, 302);
    await assert.rejects(auth.callback(req, response(), callback), { status: 400 });
    const sessionReq = { headers: { cookie: result.headers["Set-Cookie"][0].split(";")[0] } };
    const session = auth.session(sessionReq);
    await auth.authorize(session, gid);
    managed = false;
    await assert.rejects(auth.authorize(session, gid), { status: 403 });
    assert.throws(
        () =>
            auth.csrf({ headers: { origin: "http://attacker.test", "x-csrf-token": session.csrf } }, session),
        { status: 403 },
    );
    auth.csrf({ headers: { origin: env.WEB_URL, "x-csrf-token": session.csrf } }, session);
    auth.logout(sessionReq, response());
    assert.throws(() => auth.session(sessionReq), { status: 401 });
    auth.close();
});
test("HTTP authorization and CSRF block direct guild writes; public assets contain no secrets", async (t) => {
    const db = { getDB: () => ({}), getGuild: () => ({}), getUser: () => ({}) };
    const auth = {
        configured: false,
        session() {
            throw Object.assign(new Error("Unauthorized"), { status: 401 });
        },
        close() {},
    };
    const server = createDashboard({ db, auth, env });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const asset = await fetch(base);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.doesNotMatch(await asset.text(), /SUPABASE_SERVICE_ROLE_KEY|DISCORD_TOKEN|SESSION_SECRET/);
    assert.equal(
        (await fetch(`${base}/api/guilds/${gid}/settings`, { method: "PATCH", body: "{}" })).status,
        401,
    );
    assert.equal((await fetch(`${base}/api/owner`)).status, 401);
    assert.equal((await fetch(`${base}/api/config`)).status, 200);
});
test("settings save validates guild-owned channels, serializes competing versions and persists audit", async () => {
    let data = { configVersion: 0, prefix: "z" };
    let writes = 0;
    const db = {
        getGuild: () => data,
        updateGuild: (id, patch) => {
            data = { ...data, ...patch };
        },
        flush: async () => {
            writes++;
        },
    };
    const service = createSettingsService(db, {});
    const guild = { id: gid, channels: { fetch: async () => new Map() } };
    await assert.rejects(service.update(guild, uid, { version: 0, patch: { logChannel: uid } }), {
        status: 400,
    });
    const results = await Promise.allSettled([
        service.update(guild, uid, { version: 0, patch: { prefix: "!" } }),
        service.update(guild, uid, { version: 0, patch: { prefix: "?" } }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(writes, 1);
    assert.equal(data.prefix, "!");
    assert.equal(data.configAudit[0].actor, uid);
    await assert.rejects(service.update(guild, uid, { version: 1, patch: { ownerIds: [uid] } }));
});
test("web music control requires voice membership even with Manage Server permission", async () => {
    let pauses = 0;
    const queue = { songs: [{}], voiceChannel: { id: gid }, pause: async () => pauses++ };
    const client = { music: { getQueue: () => queue, settings: { music: {} } } };
    const guild = {
        id: gid,
        members: { fetch: async () => ({ voice: { channelId: uid }, permissions: { has: () => true } }) },
    };
    await assert.rejects(control(client, guild, uid, { action: "pause" }), { status: 403 });
    assert.equal(pauses, 0);
});
test("welcome and goodbye payloads expand variables, restrict mentions and serialize Discord components", () => {
    const member = {
        id: uid,
        displayName: "Tester",
        user: {
            username: "test",
            createdAt: new Date("2020-01-01"),
            displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
        },
        guild: { id: gid, name: "Community", memberCount: 42 },
    };
    assert.equal(expand("{displayName} {serverId} {createdAt}", member), `Tester ${gid} 2020-01-01`);
    const payload = buildPayload(member, {
        message: "Hello {user} @everyone",
        title: "Welcome to {server}",
        description: "Member #{memberCount}",
        thumbnail: true,
        color: "#b7a4ef",
        buttonLabel: "Rules",
        buttonUrl: "https://example.com/rules",
    });
    assert.deepEqual(payload.allowedMentions, { parse: [], users: [uid] });
    assert.equal(payload.embeds[0].toJSON().title, "Welcome to Community");
    assert.equal(payload.components[0].toJSON().components[0].style, 5);
});

test("SSE pushes real player state and releases music listeners when the browser disconnects", async (t) => {
    const { EventEmitter } = require("node:events");
    const music = new EventEmitter();
    music.getQueue = () => null;
    music.lavalink = { getIdealNode: () => ({}) };
    const guild = { id: gid };
    const client = { music, guilds: { cache: new Map([[gid, guild]]) } };
    const auth = {
        configured: true,
        session: () => ({ user: { id: uid } }),
        authorize: async () => guild,
        close() {},
    };
    const server = createDashboard({ client, auth, env, db: {} });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => {
        server.closeAllConnections();
        return new Promise((resolve) => server.close(resolve));
    });
    const abort = new AbortController();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/guilds/${gid}/stream`, {
        signal: abort.signal,
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.match(new TextDecoder().decode(first.value), /"status":"idle"/);
    assert.equal(music.listenerCount("change"), 1);
    abort.abort();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(music.listenerCount("change"), 0);
});
