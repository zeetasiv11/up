const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");
const { initializeMusicEmojis, emojiName } = require("../src/music/MusicAssets");
const { MusicEmojiManager } = require("../src/music/MusicEmojiManager");
const { MusicPanelUpdater } = require("../src/music/MusicPanelUpdater");
const { buildNowPlayingEmbed, buildControlRows } = require("../utils/musicPanel");
const { silent } = require("./helpers.cjs");

test("application emojis upload once, reuse persisted names and respect explicit overrides", async () => {
    const cache = new Collection();
    let uploads = 0;
    const manager = { cache, fetch: async () => cache, create: async ({ name }) => {
        const emoji = { id: String(111111111111111110n + BigInt(++uploads)), name, animated: true };
        cache.set(emoji.id, emoji); return emoji;
    } };
    const client = { application: { emojis: manager }, emojis: { cache: new Collection() } };
    await Promise.all([initializeMusicEmojis(client, silent), initializeMusicEmojis(client, silent)]);
    assert.equal(uploads, 6);
    await initializeMusicEmojis({ ...client }, silent); // Simulate a restart with existing application assets.
    assert.equal(uploads, 6);
    const guild = { id: "guild", client, emojis: { cache: new Collection() } };
    const channel = { permissionsFor: () => ({ has: () => false }) };
    assert.match(new MusicEmojiManager({ guild, channel, env: {} }).get("music"), /^<a:zeechei_music_v1:/);
    const custom = { id: "222222222222222222", name: "custom", animated: false, guild };
    client.emojis.cache.set(custom.id, custom);
    const options = { guild, channel, env: {}, overrides: { music: `<:custom:${custom.id}>` } };
    assert.equal(new MusicEmojiManager(options).get("music"), options.overrides.music);
    options.overrides.music = "🎧";
    assert.equal(new MusicEmojiManager(options).get("music"), "🎧");
    custom.guild = { id: "external" };
    options.overrides.music = `<:custom:${custom.id}>`;
    assert.match(new MusicEmojiManager(options).get("music"), /^<a:zeechei_music_v1:/);
    assert.ok(cache.some(emoji => emoji.name === emojiName("music")));
});

test("failed emoji list never uploads duplicates or prevents startup", async () => {
    let uploads = 0;
    await initializeMusicEmojis({ application: { emojis: {
        fetch: async () => { throw Object.assign(Error(), { code: 50013 }); },
        create: async () => { uploads++; },
    } } }, silent);
    assert.equal(uploads, 0);
});

function fixture() {
    let stored = null, serial = 0;
    const sent = [];
    const channel = { id: "channel", guildId: "guild", isTextBased: () => true, send: async payload => {
        sent.push(payload);
        return { id: `message-${++serial}`, channelId: "channel", channel, author: { id: "bot" },
            attachments: new Collection((payload.files || []).map((file, i) => [String(i), { id: String(i), name: file.name }])),
            edit: async () => {}, delete: async () => {} };
    } };
    const queue = { id: "guild", textChannel: channel, songs: [{ name: "No artwork", duration: 10 }], volume: 72 };
    const repository = { getGuild: () => ({ musicPanel: stored }), updateGuild: (id, patch) => { stored = patch.musicPanel; } };
    const client = { user: { id: "bot" }, music: { getQueue: () => queue } };
    const updater = new MusicPanelUpdater(client, repository, silent);
    return { updater, queue, client, repository, sent };
}

test("deleted cached panel reuploads every attachment; paused state uses a still image", async () => {
    const f = fixture();
    const panel = await f.updater.update(f.queue);
    assert.equal(f.sent[0].files.length, 2);
    assert.match(f.sent[0].embeds[0].data.image.url, /equalizer-banner.gif/);
    assert.match(f.sent[0].embeds[0].data.thumbnail.url, /^attachment:/);
    panel.edit = async () => { throw Object.assign(Error(), { code: 10008 }); };
    f.queue.volume = 50;
    await f.updater.update(f.queue);
    assert.equal(f.sent.length, 2);
    assert.deepEqual(f.sent[1].files.map(file => file.name), f.sent[0].files.map(file => file.name));
    assert.deepEqual(f.sent[1].attachments, []);
    f.queue.paused = true;
    assert.match(buildNowPlayingEmbed(f.queue, f.queue.songs[0]).data.image.url, /equalizer-paused.png/);
    assert.ok(buildControlRows(f.queue)[0].toJSON().components.slice(3).every(button => button.disabled));
});

test("leaving retires inaccessible panel and suppresses pending writes before next session", async () => {
    const f = fixture();
    const panel = await f.updater.update(f.queue);
    panel.delete = async () => { throw Object.assign(Error(), { code: 50013 }); };
    const pending = f.updater.update(f.queue);
    f.queue.destroyed = true;
    await f.updater.endSession("guild");
    await pending;
    assert.equal(f.updater.panels.size, 0);
    assert.equal(f.repository.getGuild("guild").musicPanel, null);
    assert.equal(f.sent.length, 1);
    assert.equal(await f.updater.update(f.queue), null);
    f.queue.destroyed = false;
    await f.updater.update(f.queue);
    assert.equal(f.sent.length, 2);
});

test("startup retires saved panels when no player exists, without joining voice", async () => {
    const f = fixture();
    f.repository.updateGuild("guild", { musicPanel: { channelId: "old", messageId: "old" } });
    f.repository.getDB = () => ({ guilds: { guild: f.repository.getGuild("guild") } });
    f.client.guilds = { cache: new Collection([["guild", {}]]) };
    f.client.music.getQueue = () => null;
    f.client.channels = { fetch: async () => { throw Object.assign(Error(), { code: 50013 }); } };
    await f.updater.restore();
    assert.equal(f.repository.getGuild("guild").musicPanel, null);
    assert.equal(f.sent.length, 0);
});

test("voice teardown failure still retires the panel reference", async t => {
    const { fixture: musicFixture, track } = require("./music-fixture.cjs");
    const f = musicFixture();
    t.after(() => f.manager.close());
    const voice = f.voice("guild");
    await f.manager.enqueue(voice, [track(1)], { member: f.member(voice) });
    let retired = 0;
    f.manager.panels.endSession = async () => { retired++; };
    f.lavalink.leaveVoiceChannel = async () => { throw Error("node unavailable"); };
    await assert.rejects(f.manager.leave("guild"), /node unavailable/);
    assert.equal(retired, 1);
    assert.equal(f.manager.getQueue("guild"), null);
});

test("nowplaying reply supplies the image referenced by its embed", async () => {
    const { load } = require("./helpers.cjs");
    const f = fixture();
    const command = load("commands/music/nowplaying.js", {
        "../../utils/musicChecks.js": { requireQueue: async () => f.queue }
    });
    let reply;
    await command.execute({ reply: async payload => { reply = payload; } });
    assert.equal(reply.embeds[0].data.image.url, `attachment://${reply.files[0].name}`);
});
