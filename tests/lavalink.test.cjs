const { test } = require("node:test");
const assert = require("node:assert/strict");
const { identifier } = require("../src/music/TrackResolver.js");
const { fixture, track } = require("./music-fixture.cjs");

test("Lavalink queue isolates guilds, enforces queue size and voice channel, awaits playback controls", async () => {
    const { manager, players, voice, member } = fixture(),
        a = voice("a"),
        b = voice("b");
    try {
        await manager.enqueue(a, [track(1), track(2)], { member: member(a) });
        await manager.enqueue(b, [track(3)], { member: member(b) });
        const queue = manager.getQueue("a");
        await queue.pause();
        assert.equal(players.get("a").paused, true);
        await queue.resume();
        await queue.setVolume(30);
        await queue.seek(90);
        assert.equal(players.get("a").volume, 30);
        assert.equal(queue.currentTime, 90);
        await queue.skip();
        assert.equal(queue.songs[0].name, "Track 2");
        assert.equal(manager.getQueue("b").songs[0].name, "Track 3");
        await queue.previous();
        assert.equal(queue.songs[0].name, "Track 1");
        await assert.rejects(manager.enqueue(a, [track(4), track(5)], { member: member(a) }), /batas/);
        const other = { ...a, id: "other" };
        await assert.rejects(manager.enqueue(other, [track(4)], { member: member(other) }), /Bot berada/);
        await manager.leave("a");
        assert.equal(manager.getQueue("a"), null);
        assert.ok(manager.getQueue("b"));
    } finally {
        await manager.close();
    }
});

test("loop, autoplay and stale end events use the current queue", async () => {
    const { manager, players, voice, member } = fixture(),
        channel = voice("a");
    try {
        await manager.enqueue(channel, [track(1), track(2)], { member: member(channel) });
        const queue = manager.getQueue("a");
        await queue.setRepeatMode(1);
        await manager.run("a", () => queue.advance());
        assert.equal(queue.songs.length, 2);
        await queue.setRepeatMode(2);
        await manager.run("a", () => queue.advance());
        assert.equal(queue.songs[0].name, "Track 2");
        players.get("a").emit("end", { reason: "finished", track: track(1) });
        await manager.run("a", async () => {});
        assert.equal(queue.songs[0].name, "Track 2");
        await queue.setRepeatMode(0);
        queue.autoplay = true;
        await queue.skip();
        await queue.skip();
        assert.equal(queue.songs[0].name, "Track 3");
    } finally {
        await manager.close();
    }
});

test("filters use only node-supported Lavalink fields and reject unsupported effects", async () => {
    const { manager, players, voice, member, node } = fixture(),
        channel = voice("a");
    try {
        await manager.enqueue(channel, [track(1)], { member: member(channel) });
        const filters = manager.getQueue("a").filters;
        await filters.add("nightcore");
        assert.equal(players.get("a").filters.timescale.speed, 1.15);
        await assert.rejects(filters.add("echo"), /tidak didukung/);
        node.info.filters = [];
        await assert.rejects(filters.add("bassboost"), /tidak didukung/);
        await filters.clear();
        assert.deepEqual(players.get("a").filters, {});
    } finally {
        await manager.close();
    }
});

test("resolver rejects private/arbitrary URL hosts and never selects a local-file protocol", () => {
    assert.equal(identifier("artist song"), "ytsearch:artist song");
    assert.equal(identifier("https://www.youtube.com/watch?v=test"), "https://www.youtube.com/watch?v=test");
    for (const input of [
        "http://127.0.0.1/secret",
        "http://localhost/secret",
        "file:///etc/passwd",
        "https://youtube.com.evil.test/song",
        "https://user:pass@youtube.com/test",
    ]) {
        assert.throws(() => identifier(input));
    }
});

test("saved player restores queue, position and pause state without mixing guilds", async () => {
    const { manager, voice, member } = fixture(),
        channel = voice("restore");
    const data = {};
    manager.repository = {
        getGuild: (id) => (data[id] ||= {}),
        updateGuild: (id, patch) => {
            Object.assign((data[id] ||= {}), structuredClone(patch));
        },
        getDB: () => ({ guilds: data }),
    };
    channel.isVoiceBased = () => true;
    channel.guild.channels = { fetch: async (id) => (id === channel.id ? channel : null) };
    manager.client.guilds = { cache: new Map([["restore", channel.guild]]) };
    try {
        await manager.enqueue(channel, [track(1), track(2)], { member: member(channel) });
        const queue = manager.getQueue("restore");
        await queue.seek(40);
        await queue.pause();
        const saved = structuredClone(data.restore.musicState);
        data.restore.musicMode247 = true;
        manager.closing = true;
        await manager.leave("restore");
        manager.closing = false;
        data.restore.musicState = saved;
        manager.suspended.clear();
        await manager.restorePlayers();
        const restored = manager.getQueue("restore");
        assert.equal(restored.songs.length, 2);
        assert.equal(restored.currentTime, 40);
        assert.equal(restored.paused, true);
    } finally {
        await manager.close();
    }
});

test("queue edits validate positions inside the guild lock and preserve the current track", async () => {
    const { manager, voice, member } = fixture(),
        channel = voice("edits");
    try {
        await manager.enqueue(channel, [track(1), track(2), track(3)], { member: member(channel) });
        const queue = manager.getQueue("edits");
        await queue.move(2, 1);
        assert.deepEqual(
            queue.songs.map((s) => s.name),
            ["Track 1", "Track 3", "Track 2"],
        );
        assert.equal((await queue.remove(2)).name, "Track 2");
        await assert.rejects(queue.remove(0), /position/);
        assert.equal((await queue.clear()).length, 1);
        assert.equal(queue.songs[0].name, "Track 1");
    } finally {
        await manager.close();
    }
});
