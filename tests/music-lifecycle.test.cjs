const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setImmediate: flush } = require("node:timers/promises");
const { fixture, track } = require("./music-fixture.cjs");
const { load, silent } = require("./helpers.cjs");
const { playerState, control } = require("../web/backend/music");
const { handleMusicButton } = require("../utils/musicButtons");
const play = load("commands/music/play.js", { "../../utils/logger.js": silent });
function session(options) {
    const f = fixture(options);
    f.channel = f.voice("guild");
    f.channel.isVoiceBased = () => true;
    f.listener = f.member(f.channel);
    f.listener.voice.channelId = f.channel.id;
    f.listener.permissions = { has: () => true };
    f.listener.roles = { cache: new Map() };
    f.listener.guild = f.channel.guild;
    f.channel.guild.members.fetch = async () => f.listener;
    f.channel.guild.channels = { fetch: async (id) => (id === f.channel.id ? f.channel : null) };
    f.manager.client.music = f.manager;
    f.manager.client.distube = f.manager;
    f.manager.client.guilds = { cache: new Map([["guild", f.channel.guild]]) };
    f.interaction = {
        id: "request",
        guildId: "guild",
        guild: f.channel.guild,
        member: f.listener,
        user: f.listener.user,
        client: f.manager.client,
        channel: null,
        options: { getString: () => "song" },
        reply: async (value) => {
            f.reply = value;
        },
        deferReply: async () => {},
        editReply: async (value) => {
            f.reply = value;
        },
        deferUpdate: async () => {},
        followUp: async (value) => {
            f.reply = value;
        },
    };
    return f;
}
const enqueue = (f, tracks = [track(1)]) => f.manager.enqueue(f.channel, tracks, { member: f.listener });
const drain = async (f) => {
    await flush();
    await f.manager.run("guild", async () => {});
    await flush();
};

test("fresh /play starts the first search result immediately and repeated commands keep one player/queue", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await play.execute(f.interaction);
    const q = f.manager.getQueue("guild"),
        player = q.player;
    assert.equal(player.track, track(1).encoded);
    f.node.rest.resolve = async () => ({ loadType: "track", data: track(2) });
    await play.execute(f.interaction);
    f.node.rest.resolve = async () => ({ loadType: "track", data: track(3) });
    await play.execute(f.interaction);
    assert.equal(f.lavalink.joins, 1);
    assert.equal(f.manager.getQueue("guild"), q);
    assert.equal(q.player, player);
    assert.deepEqual(
        q.songs.map((song) => song.name),
        ["Track 1", "Track 2", "Track 3"],
    );
    for (const number of [1, 2]) {
        player.emit("end", { reason: "finished", track: { ...track(number), userData: player.userData } });
        await drain(f);
        assert.equal(player.track, track(number + 1).encoded);
    }
});

test("concurrent creation and concurrent enqueues never duplicate guild players", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    const [a, b] = await Promise.all([f.manager.connect(f.channel), f.manager.connect(f.channel)]);
    assert.equal(a, b);
    await Promise.all([enqueue(f, [track(1)]), enqueue(f, [track(2)]), enqueue(f, [track(3)])]);
    assert.equal(f.lavalink.joins, 1);
    assert.deepEqual(
        a.songs.map((song) => song.name),
        ["Track 1", "Track 2", "Track 3"],
    );
});

test("panel and dashboard controls act on the active player; volume/seek/filter changes preserve pause", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f, [track(1), track(2)]);
    const q = f.manager.getQueue("guild"),
        player = q.player;
    await f.manager.withMember(f.listener, () => handleMusicButton(f.interaction, "music_playpause"));
    assert.equal(playerState(f.manager.client, "guild").status, "paused");
    await control(f.manager.client, f.channel.guild, f.listener.user.id, { action: "volume", value: 35 });
    await q.seek(15);
    await q.filters.add("bassboost");
    assert.equal(q.paused, true);
    assert.equal(playerState(f.manager.client, "guild").volume, 35);
    await q.filters.clear();
    assert.deepEqual(player.filters, {});
    await control(f.manager.client, f.channel.guild, f.listener.user.id, { action: "resume" });
    await f.manager.withMember(f.listener, () => handleMusicButton(f.interaction, "music_skip"));
    assert.equal(playerState(f.manager.client, "guild").track.title, "Track 2");
    assert.equal(q.player, player);
    assert.equal(f.lavalink.joins, 1);
});

test("empty/error/malformed search and invalid tracks fail before any voice connection", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    for (const result of [
        null,
        { loadType: "empty" },
        { loadType: "error" },
        { loadType: "search", data: [] },
        { loadType: "track", data: {} },
    ]) {
        f.node.rest.resolve = async () => result;
        await play.execute(f.interaction);
        assert.ok(f.reply.embeds);
        assert.equal(f.lavalink.joins, 0);
        assert.equal(f.manager.getQueue("guild"), null);
    }
    await assert.rejects(enqueue(f, [{}]), /valid/);
    assert.equal(f.manager.recoveries.size, 0);
});

test("fresh playback failure cleans up and a subsequent play succeeds", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    const join = f.lavalink.joinVoiceChannel;
    f.lavalink.joinVoiceChannel = async (options) => {
        const player = await join(options);
        player.playTrack = async () => {
            throw new Error("node rejected playback");
        };
        return player;
    };
    await assert.rejects(enqueue(f), /rejected/);
    assert.equal(f.manager.getQueue("guild"), null);
    assert.equal(f.players.size, 0);
    f.lavalink.joinVoiceChannel = join;
    await enqueue(f);
    assert.equal(f.manager.getQueue("guild").player.track, track(1).encoded);
});

test("commands waiting behind another guild operation recheck player identity and member voice", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f);
    const q = f.manager.getQueue("guild");
    let release;
    const blocked = f.manager.run(
        "guild",
        () =>
            new Promise((resolve) => {
                release = resolve;
            }),
    );
    await flush();
    const denied = f.manager.withMember(f.listener, () => q.pause());
    f.listener.voice.channel = { id: "other-voice" };
    release();
    await blocked;
    await assert.rejects(denied, /voice/);
    assert.equal(q.paused, false);
    f.listener.voice.channel = f.channel;
    await f.manager.leave("guild");
    await enqueue(f);
    await assert.rejects(q.setVolume(5), /aktif/);
    assert.equal(f.manager.getQueue("guild").volume, 72);
});

test("read-only panel buttons also enforce the guild and voice boundary", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f);
    f.listener.voice.channel = { id: "other" };
    await handleMusicButton(f.interaction, "music_queue");
    assert.equal(f.reply.ephemeral, true);
    assert.match(f.reply.embeds[0].data.description, /voice channel/);
});

test("exception, stuck and duplicate end events advance once; old play tokens cannot skip a replay", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f, [track(1), track(1), track(3)]);
    const q = f.manager.getQueue("guild"),
        oldToken = q.playId;
    const failed = { ...track(1), userData: { playId: oldToken } };
    q.player.emit("exception", { track: failed });
    q.player.emit("end", { reason: "loadFailed", track: failed });
    await drain(f);
    assert.equal(q.songs.length, 2);
    q.player.emit("stuck", { track: failed });
    await drain(f);
    assert.equal(q.songs.length, 2);
    q.player.emit("stuck", { track: { ...track(1), userData: { playId: q.playId } } });
    await drain(f);
    assert.equal(q.songs[0].name, "Track 3");
});

test("normal startup never restores saved playback; 24/7 restores once and manual leave suppresses restoration", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f, [track(1), track(2)]);
    await f.manager.getQueue("guild").pause();
    const saved = structuredClone(f.data.guild.musicState);
    await f.manager.disconnect("guild", { preserveState: true });
    await f.manager.restorePlayers();
    assert.equal(f.lavalink.joins, 1);
    f.data.guild.musicMode247 = true;
    f.data.guild.musicState = saved;
    await Promise.all([f.manager.restorePlayers(), f.manager.restorePlayers()]);
    assert.equal(f.lavalink.joins, 2);
    assert.equal(f.manager.getQueue("guild").paused, true);
    await f.manager.leave("guild");
    await f.manager.restorePlayers();
    assert.equal(f.lavalink.joins, 2);
    assert.equal(f.data.guild.musicState.suspended, true);
});

test("24/7 recovery is single, preserves queue/settings, and stop cancels further joins", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session({ leaveOnStop: true });
    t.after(() => f.manager.close());
    f.data.guild = { musicMode247: true };
    await enqueue(f, [track(1), track(2)]);
    const old = f.manager.getQueue("guild");
    await old.seek(10);
    await old.pause();
    await old.filters.add("bassboost");
    f.manager.handleVoiceDisconnect("guild");
    f.manager.handleVoiceDisconnect("guild");
    assert.equal(f.manager.recoveries.size, 1);
    t.mock.timers.tick(5000);
    await drain(f);
    const recovered = f.manager.getQueue("guild");
    assert.notEqual(recovered, old);
    assert.equal(f.players.size, 1);
    assert.equal(f.lavalink.joins, 2);
    assert.equal(recovered.songs.length, 2);
    assert.equal(recovered.currentTime, 10);
    assert.equal(recovered.paused, true);
    assert.equal(recovered.filters.has("bassboost"), true);
    old.player.emit("closed");
    assert.equal(f.manager.recoveries.size, 0);
    f.manager.handleVoiceDisconnect("guild");
    await control(f.manager.client, f.channel.guild, f.listener.user.id, { action: "stop" });
    t.mock.timers.tick(60000);
    await drain(f);
    assert.equal(f.lavalink.joins, 2);
    assert.equal(f.manager.getQueue("guild"), null);
    assert.equal(f.manager.recoveries.size, 0);
});

test("Lavalink interruption keeps the same player; missing player recovery has bounded attempts", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session();
    t.after(() => f.manager.close());
    f.data.guild = { musicMode247: true };
    await enqueue(f);
    const q = f.manager.getQueue("guild");
    f.node.available = false;
    f.manager.nodeUnavailable("primary");
    assert.equal(playerState(f.manager.client, "guild").status, "loading");
    f.node.available = true;
    await f.manager.reconcileNode();
    assert.equal(f.manager.getQueue("guild"), q);
    assert.equal(f.lavalink.joins, 1);
    f.players.delete("guild");
    await f.manager.reconcileNode();
    f.node.available = false;
    for (const delay of [5000, 10000, 15000, 20000, 25000]) {
        t.mock.timers.tick(delay);
        await drain(f);
    }
    assert.equal(f.manager.recoveries.size, 0);
    assert.equal(f.manager.getQueue("guild"), null);
    assert.equal(f.lavalink.joins, 1);
});

test("empty voice timeout rechecks membership; 24/7 prevents idle cleanup", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session({ leaveOnEmpty: true, leaveOnEmptyCooldown: 60 });
    t.after(() => f.manager.close());
    let humans = 0;
    f.channel.members = { filter: () => ({ size: humans }) };
    await enqueue(f);
    f.manager.checkEmpty("guild");
    t.mock.timers.tick(59000);
    await drain(f);
    assert.ok(f.manager.getQueue("guild"));
    humans = 1;
    t.mock.timers.tick(1000);
    await drain(f);
    assert.ok(f.manager.getQueue("guild"));
    humans = 0;
    f.data.guild.musicMode247 = true;
    f.manager.checkEmpty("guild");
    t.mock.timers.tick(60000);
    await drain(f);
    assert.ok(f.manager.getQueue("guild"));
    f.data.guild.musicMode247 = false;
    f.manager.checkEmpty("guild");
    t.mock.timers.tick(60000);
    await drain(f);
    assert.equal(f.manager.getQueue("guild"), null);
});

test("leave cancels a recovery already awaiting voice negotiation", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session();
    t.after(() => f.manager.close());
    f.data.guild = { musicMode247: true };
    await enqueue(f);
    const join = f.lavalink.joinVoiceChannel;
    let release;
    f.lavalink.joinVoiceChannel = (options) =>
        new Promise((resolve) => {
            release = () => resolve(join(options));
        });
    f.manager.handleVoiceDisconnect("guild");
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(typeof release, "function");
    const leaving = f.manager.leave("guild");
    release();
    await leaving;
    await drain(f);
    t.mock.timers.tick(60000);
    await drain(f);
    assert.equal(f.manager.getQueue("guild"), null);
    assert.equal(f.players.size, 0);
    assert.equal(f.manager.recoveries.size, 0);
    assert.equal(f.lavalink.joins, 2);
    assert.equal(f.data.guild.musicState.suspended, true);
});

test("turning persistent mode off during channel lookup prevents a startup join", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    f.data.guild = {
        musicMode247: true,
        musicState: { voiceChannelId: f.channel.id, songs: [], updatedAt: Date.now() },
    };
    let release;
    f.channel.guild.channels.fetch = () =>
        new Promise((resolve) => {
            release = resolve;
        });
    const restoring = f.manager.restorePlayers();
    await flush();
    f.data.guild.musicMode247 = false;
    release(f.channel);
    await restoring;
    assert.equal(f.lavalink.joins, 0);
});

test("concurrent relative controls read volume and loop inside the guild lock", async (t) => {
    const f = session();
    t.after(() => f.manager.close());
    await enqueue(f);
    const q = f.manager.getQueue("guild");
    await Promise.all([q.adjustVolume(10), q.adjustVolume(10)]);
    await Promise.all([q.setRepeatMode(), q.setRepeatMode()]);
    assert.equal(q.volume, 92);
    assert.equal(q.repeatMode, 2);
});

test("advancing tracks does not cancel an empty-voice timeout", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session({ leaveOnEmpty: true, leaveOnEmptyCooldown: 60 });
    t.after(() => f.manager.close());
    f.channel.members = { filter: () => ({ size: 0 }) };
    await enqueue(f, [track(1), track(2)]);
    f.manager.checkEmpty("guild");
    t.mock.timers.tick(30000);
    await f.manager.getQueue("guild").skip();
    t.mock.timers.tick(30000);
    await drain(f);
    assert.equal(f.manager.getQueue("guild"), null);
});

test("a human returning to voice cancels empty cleanup but preserves finish cleanup", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = session({
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 60,
        leaveOnFinish: true,
        leaveOnFinishCooldown: 60,
    });
    t.after(() => f.manager.close());
    let humans = 0;
    f.channel.members = { filter: () => ({ size: humans }) };
    await enqueue(f);
    f.manager.checkEmpty("guild");
    await f.manager.getQueue("guild").skip();
    humans = 1;
    f.manager.checkEmpty("guild");
    t.mock.timers.tick(60000);
    await drain(f);
    assert.equal(f.manager.getQueue("guild"), null);
});

test("shutdown releases players even if the final database snapshot fails", async () => {
    const f = session();
    await enqueue(f);
    f.manager.repository.updateGuild = () => {
        throw new Error("database offline");
    };
    await f.manager.close();
    assert.equal(f.players.size, 0);
    assert.equal(f.manager.getQueue("guild"), null);
});
