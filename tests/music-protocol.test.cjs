const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { EventEmitter, once } = require("node:events");
const { WebSocketServer } = require("ws");
const { Player } = require("shoukaku");
const { createLavalink } = require("../src/music/LavalinkManager");
const { MusicManager } = require("../src/music/MusicManager");
const { silent } = require("./helpers.cjs");
const { track } = require("./music-fixture.cjs");

test("actual Shoukaku uses one Discord voice handshake and Lavalink player through queue and controls", async (t) => {
    const state = new Map(),
        packets = [],
        writes = [];
    const server = http.createServer(async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.url.startsWith("/v4/loadtracks"))
            return res.end(JSON.stringify({ loadType: "search", data: [track(1)] }));
        if (req.url === "/v4/info")
            return res.end(JSON.stringify({ filters: ["equalizer"], sourceManagers: ["youtube"] }));
        if (req.method === "PATCH") {
            let raw = "";
            for await (const chunk of req) raw += chunk;
            const patch = JSON.parse(raw);
            if (req.url.includes("/players/")) {
                const id = "guild",
                    current = state.get(id) || { paused: false, filters: {} };
                state.set(id, { ...current, ...patch });
                writes.push(patch);
                return res.end(JSON.stringify({ guildId: id, ...state.get(id) }));
            }
            return res.end(JSON.stringify(patch));
        }
        if (req.method === "DELETE") {
            state.delete("guild");
            res.statusCode = 204;
            return res.end();
        }
        res.statusCode = 404;
        res.end("{}");
    });
    let rejectHandshakes = 0,
        handshakes = 0;
    const sockets = new WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
        handshakes++;
        if (rejectHandshakes > 0) {
            rejectHandshakes--;
            socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
            return;
        }
        sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit("connection", ws, req));
    });
    sockets.on("connection", (socket) =>
        socket.send(JSON.stringify({ op: "ready", sessionId: "synthetic-node-session", resumed: false })),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const client = new EventEmitter();
    client.user = { id: "bot" };
    const botVoice = { channelId: null };
    let suppressVoiceServer = false;
    client.ws = {
        shards: new Map([
            [
                0,
                {
                    send: (payload) => {
                        packets.push(payload);
                        botVoice.channelId = payload.d.channel_id;
                        queueMicrotask(() => {
                            client.emit("raw", {
                                t: "VOICE_STATE_UPDATE",
                                d: {
                                    guild_id: "guild",
                                    user_id: "bot",
                                    channel_id: payload.d.channel_id,
                                    session_id: "synthetic-voice-session",
                                    self_deaf: true,
                                    self_mute: false,
                                },
                            });
                            if (payload.d.channel_id && !suppressVoiceServer)
                                client.emit("raw", {
                                    t: "VOICE_SERVER_UPDATE",
                                    d: {
                                        guild_id: "guild",
                                        endpoint: "synthetic.voice.invalid",
                                        token: "synthetic-voice-token",
                                    },
                                });
                        });
                    },
                },
            ],
        ]),
    };
    const lavalink = createLavalink(client, silent, {
        LAVALINK_HOST: "127.0.0.1",
        LAVALINK_PORT: String(server.address().port),
        LAVALINK_PASSWORD: "synthetic-local-password",
    });
    const ready = once(lavalink, "ready");
    client.emit("clientReady");
    await ready;
    lavalink.getIdealNode().info = await lavalink.getIdealNode().rest.getLavalinkInfo();
    const data = { musicMode247: false };
    const manager = new MusicManager({
        client,
        lavalink,
        panels: { update: async () => {} },
        settings: { music: { defaultVolume: 72, maxQueueSize: 10, leaveOnStop: true } },
        repository: { getGuild: () => data, updateGuild: (_, patch) => Object.assign(data, patch) },
        history() {},
        logger: silent,
    });
    t.after(async () => {
        await manager.close();
        for (const socket of sockets.clients) socket.terminate();
        await new Promise((resolve) => sockets.close(resolve));
        await new Promise((resolve) => server.close(resolve));
    });
    const guild = { id: "guild", shardId: 0, members: { me: { voice: botVoice } } };
    const voice = {
        id: "voice",
        guild,
        isVoiceBased: () => true,
        permissionsFor: () => ({ has: () => true }),
    };
    const member = { guild, voice: { channel: voice }, user: { id: "listener" } };
    await manager.play(voice, "song", { member });
    const q = manager.getQueue("guild");
    assert.ok(q.player instanceof Player);
    await manager.enqueue(voice, [track(2), track(3)], { member });
    await q.pause();
    await q.setVolume(35);
    await q.seek(10);
    await q.filters.add("bassboost");
    assert.equal(q.player.paused, true);
    assert.equal(state.get("guild").paused, true);
    assert.equal(state.get("guild").volume, 35);
    assert.equal(state.get("guild").position, 10000);
    // A node outage followed by one failed handshake must still resume successfully.
    lavalink.options.reconnectInterval = 0.01;
    lavalink.options.reconnectTries = 3;
    const nodeReadyAgain = new Promise((resolve) => lavalink.once("ready", resolve));
    rejectHandshakes = 1;
    for (const socket of sockets.clients) socket.terminate();
    await nodeReadyAgain;
    await manager.reconcileNode();
    assert.equal(lavalink.players.get("guild"), q.player);
    assert.equal(lavalink.getIdealNode().state, 1);
    assert.equal(handshakes, 3);
    assert.equal(state.get("guild").paused, true);
    assert.equal(state.get("guild").position, 10000);
    await q.filters.clear();
    assert.deepEqual(q.player.filters, {});
    assert.deepEqual(state.get("guild").filters, {});
    await q.resume();
    await q.skip();
    assert.equal(state.get("guild").track.encoded, track(2).encoded);
    assert.equal(lavalink.players.get("guild"), q.player);
    assert.equal(packets.filter((packet) => packet.d.channel_id).length, 1);
    assert.equal(lavalink.connections.size, 1);
    assert.ok(writes.find((patch) => patch.track?.userData?.playId));
    await q.stop();
    assert.equal(state.has("guild"), false);
    assert.equal(lavalink.players.size, 0);
    assert.equal(lavalink.connections.size, 0);
    assert.equal(manager.getQueue("guild"), null);
    suppressVoiceServer = true;
    lavalink.options.voiceConnectionTimeout = 0.02;
    await assert.rejects(manager.play(voice, "song", { member }), /voice connection/);
    assert.equal(botVoice.channelId, null);
    assert.equal(lavalink.connections.size, 0);
    assert.equal(lavalink.players.size, 0);
    assert.equal(manager.getQueue("guild"), null);
    assert.equal(manager.recoveries.size, 0);
});
