const test = require("node:test");
const assert = require("node:assert/strict");
const { createMusicSearch } = require("../web/backend/music");
const { createMusicLibrary } = require("../web/backend/musicLibrary");
const { createDashboard } = require("../web/backend/server");
const gid = "111111111111111111",
    uid = "222222222222222222",
    cid = "333333333333333333";
function fixture() {
    const track = {
        encoded: "private-server-track",
        info: { title: "Track", author: "Artist", length: 120000, uri: "https://youtu.be/example" },
    };
    const guild = { id: gid };
    const voice = { id: "444444444444444444", guild };
    const member = {
        user: { id: uid },
        voice: { channel: voice, channelId: voice.id },
        roles: { cache: new Map() },
        permissions: { has: () => true },
    };
    const channel = { id: cid, guildId: gid, type: 0, permissionsFor: () => ({ has: () => true }) };
    guild.members = { me: {}, fetch: async () => member };
    guild.channels = { fetch: async () => channel };
    let enqueued = 0;
    const client = {
        guilds: { cache: new Map([[gid, guild]]) },
        music: {
            settings: { music: { maxQueueSize: 100 } },
            lavalink: { getIdealNode: () => ({}) },
            getQueue: () => null,
            resolve: async () => ({ type: "search", tracks: [track] }),
            enqueue: async (voice, tracks, options) => {
                assert.equal(options.member.user.id, uid);
                enqueued += tracks.length;
                return tracks.length;
            },
        },
    };
    return { client, guild, member, channel, track, enqueued: () => enqueued };
}
test("web search binds opaque selections to guild/user, rechecks voice and consumes concurrent clicks once", async () => {
    const f = fixture(),
        service = createMusicSearch();
    const result = await service.search(f.client, f.guild, uid, { query: "Artist" });
    assert.equal(result.options.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /private-server-track/);
    const input = { token: result.token, index: 0, channelId: cid };
    await assert.rejects(service.enqueue(f.client, f.guild, cid, input), { status: 409 });
    await assert.rejects(service.enqueue(f.client, { ...f.guild, id: cid }, uid, input), { status: 409 });
    f.member.voice.channelId = null;
    await assert.rejects(service.enqueue(f.client, f.guild, uid, input), { status: 403 });
    f.member.voice.channelId = f.member.voice.channel.id;
    f.channel.guildId = cid;
    await assert.rejects(service.enqueue(f.client, f.guild, uid, input), { status: 400 });
    f.channel.guildId = gid;
    await assert.rejects(service.enqueue(f.client, f.guild, uid, { ...input, encoded: "injected" }));
    const attempts = await Promise.allSettled([
        service.enqueue(f.client, f.guild, uid, input),
        service.enqueue(f.client, f.guild, uid, input),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(f.enqueued(), 1);
});
test("search expires, limits concurrent requests, and confirms playlists as one batch", async () => {
    const f = fixture();
    let now = 0;
    const service = createMusicSearch({ now: () => now });
    const result = await service.search(f.client, f.guild, uid, { query: "Artist" });
    now = 120001;
    await assert.rejects(
        service.enqueue(f.client, f.guild, uid, { token: result.token, index: 0, channelId: cid }),
        { status: 409 },
    );
    let finish;
    f.client.music.resolve = () =>
        new Promise((resolve) => {
            finish = resolve;
        });
    const pending = service.search(f.client, f.guild, uid, { query: "Artist" });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(service.search(f.client, f.guild, uid, { query: "Again" }), { status: 429 });
    finish({ type: "playlist", name: "Set", tracks: [f.track, f.track] });
    const playlist = await pending;
    assert.equal(playlist.options[0].count, 2);
    assert.equal(playlist.options.length, 1);
    const queued = await service.enqueue(f.client, f.guild, uid, {
        token: playlist.token,
        index: 0,
        channelId: cid,
    });
    assert.equal(queued.count, 2);
    assert.equal(f.enqueued(), 2);
});
function libraryFixture() {
    const users = new Map();
    const db = {
        getUser(id) {
            if (!users.has(id)) users.set(id, { favoriteSongs: [], playlists: {} });
            return users.get(id);
        },
        updateUser(id, patch) {
            Object.assign(this.getUser(id), patch);
        },
        flush: async () => {},
    };
    return { db, library: createMusicLibrary(db) };
}
test("library writes reject stale edits, isolate users and wait for persistence before acknowledgment", async () => {
    const { db, library } = libraryFixture();
    const snapshot = library.read(uid, "playlists");
    const attempts = await Promise.allSettled([
        library.update(uid, "playlists", { version: snapshot.version, action: "create", name: "Mix" }),
        library.update(uid, "playlists", { version: snapshot.version, action: "create", name: "Other" }),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(attempts[1].reason.status, 409);
    assert.deepEqual(library.read(cid, "playlists").items, {});
    let current = library.read(uid, "playlists");
    await assert.rejects(
        library.update(uid, "playlists", { version: current.version, action: "create", name: "__proto__" }),
        { status: 400 },
    );
    current = await library.update(
        uid,
        "playlists",
        { version: current.version, action: "addCurrent", name: "Mix" },
        { name: "Current", url: "https://youtu.be/current" },
    );
    assert.equal(current.items.Mix.length, 1);
    const removed = await library.update(uid, "playlists", {
        version: current.version,
        action: "remove",
        name: "Mix",
        url: "https://youtu.be/current",
    });
    assert.equal(removed.items.Mix.length, 0);
    const favorites = library.read(uid, "favorites");
    db.flush = async () => {
        throw new Error("Persistence unavailable");
    };
    await assert.rejects(
        library.update(
            uid,
            "favorites",
            { version: favorites.version, action: "addCurrent" },
            { name: "Current", url: "https://youtu.be/current" },
        ),
        /Persistence unavailable/,
    );
});
test("library and music endpoints require CSRF and fresh guild authorization; profile IDs cannot be supplied", async (t) => {
    const f = fixture(),
        { db } = libraryFixture();
    let allowed = true;
    const auth = {
        session: () => ({ user: { id: uid } }),
        csrf: (req) => {
            if (req.headers["x-csrf-token"] !== "synthetic")
                throw Object.assign(new Error("CSRF"), { status: 403 });
        },
        authorize: async () => {
            if (!allowed) throw Object.assign(new Error("Forbidden"), { status: 403 });
        },
        close() {},
    };
    const server = createDashboard({ client: f.client, db, auth });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/guilds/${gid}`;
    const version = (await (await fetch(`${base}/favorites`)).json()).version;
    const headers = { "Content-Type": "application/json" };
    assert.equal(
        (
            await fetch(`${base}/music-search`, {
                method: "POST",
                headers,
                body: JSON.stringify({ query: "Artist" }),
            })
        ).status,
        403,
    );
    headers["X-CSRF-Token"] = "synthetic";
    assert.equal(
        (
            await fetch(`${base}/favorites`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    action: "remove",
                    userId: cid,
                    version,
                    url: "https://youtu.be/current",
                }),
            })
        ).status,
        400,
    );
    allowed = false;
    assert.equal((await fetch(`${base}/favorites`)).status, 403);
    assert.equal(
        (
            await fetch(`${base}/music-search`, {
                method: "POST",
                headers,
                body: JSON.stringify({ query: "Artist" }),
            })
        ).status,
        403,
    );
});
