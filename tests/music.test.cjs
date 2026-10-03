const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");
const { MusicEmojiManager } = require("../src/music/MusicEmojiManager.js");
const { MusicPanelUpdater } = require("../src/music/MusicPanelUpdater.js");
const { buildNowPlayingEmbed, buildControlRows } = require("../utils/musicPanel.js");
const { handleMusicModal, sendQueueList } = require("../utils/musicButtons.js");
const { silent } = require("./helpers.cjs");
function queue() {
    const songs = Array.from({ length: 14 }, (_, n) => ({
        name: `Track ${n}`,
        url: `https://example.com/track/${n}`,
        thumbnail: "https://example.com/artwork.png",
        duration: 240,
        formattedDuration: "04:00",
        user: { username: "listener" },
    }));
    return {
        id: "guild",
        songs,
        previousSongs: [],
        volume: 72,
        currentTime: 100,
        formattedCurrentTime: "01:40",
        repeatMode: 0,
        paused: false,
        autoplay: false,
    };
}

test("emoji manager prefers available animation and falls back for deleted/restricted emoji", () => {
    const guild = {
        id: "guild",
        members: { me: { roles: { cache: new Collection() } } },
        emojis: { cache: new Collection() },
        client: { emojis: { cache: new Collection() } },
    };
    const staticEmoji = {
        id: "111111111111111111",
        name: "music_play",
        guild,
        animated: false,
        available: true,
    };
    const animated = { id: "222222222222222222", name: "music_play", guild, animated: true, available: true };
    guild.emojis.cache.set(staticEmoji.id, staticEmoji).set(animated.id, animated);
    const emojis = new MusicEmojiManager({ guild, env: { MUSIC_EMOJI_PLAY: "<:gone:333333333333333333>" } });
    assert.equal(emojis.getPlayEmoji(), "<a:music_play:222222222222222222>");
    animated.available = false;
    assert.equal(emojis.getPlayEmoji(), "<:music_play:111111111111111111>");
    staticEmoji.roles = { cache: new Collection([["required", { id: "required" }]]) };
    assert.equal(emojis.getPlayEmoji(), "▶️");
    assert.equal(new MusicEmojiManager({ env: { MUSIC_EMOJI_PLAY: "not-an-emoji" } }).getPlayEmoji(), "▶️");
});

test("player components serialize and show paused/loop states with native Discord limits", () => {
    const player = queue();
    player.paused = true;
    player.repeatMode = 2;
    const embed = buildNowPlayingEmbed(player, player.songs[0]).toJSON();
    assert.match(embed.description, /PAUSED/);
    assert.match(embed.description, /Loop Queue/);
    const rows = buildControlRows(player).map((row) => row.toJSON());
    assert.equal(rows.length, 3);
    assert.equal(rows[0].components[1].label, "Resume");
    assert.equal(rows[1].components[4].label, "72%");
    for (const row of rows) assert.ok(row.components.length <= 5);
    const idle = buildControlRows(null).map((row) => row.toJSON());
    assert.ok(idle.every((row) => row.components.every((component) => component.disabled)));
});

test("persistent panels reuse identity, suppress duplicate payloads and recover only missing messages", async () => {
    let created = 0,
        edits = 0,
        stored = null,
        editError;
    const panel = {
        id: "panel",
        channelId: "channel",
        author: { id: "bot" },
        edit: async () => {
            if (editError) throw editError;
            edits++;
        },
    };
    const channel = {
        id: "channel",
        guildId: "guild",
        isTextBased: () => true,
        send: async () => {
            created++;
            return panel;
        },
        messages: { fetch: async () => panel },
    };
    const repository = {
        getGuild: () => ({ musicPanel: stored }),
        updateGuild: (id, update) => {
            stored = update.musicPanel;
        },
    };
    const client = { user: { id: "bot" }, channels: { fetch: async () => channel } };
    const updater = new MusicPanelUpdater(client, repository, silent),
        player = queue();
    player.textChannel = channel;
    await Promise.all([updater.update(player), updater.update(player)]);
    assert.equal(created, 1);
    assert.equal(edits, 0);
    assert.equal(stored.messageId, "panel");
    player.volume = 30;
    await updater.update(player);
    assert.equal(edits, 1);
    editError = Object.assign(Error("permission"), { code: 50013 });
    player.volume = 40;
    await updater.update(player);
    assert.equal(created, 1);
    editError = Object.assign(Error("deleted"), { code: 10008 });
    await updater.update(player);
    assert.equal(created, 2);
});

test("restoring a saved panel does not create a duplicate on transient fetch errors or cross-guild channel", async () => {
    let created = 0;
    const repository = { getGuild: () => ({ musicPanel: { channelId: "channel", messageId: "panel" } }) };
    const channel = {
        guildId: "other-guild",
        isTextBased: () => true,
        send: async () => {
            created++;
        },
    };
    const client = {
        user: { id: "bot" },
        channels: {
            fetch: async () => {
                throw Object.assign(Error("network"), { code: 50013 });
            },
        },
    };
    const updater = new MusicPanelUpdater(client, repository, silent);
    assert.equal(await updater.update({ id: "guild", textChannel: channel }, null), null);
    client.channels.fetch = async () => channel;
    assert.equal(await updater.update({ id: "guild", textChannel: channel }, null), null);
    assert.equal(created, 0);
});

test("queue pagination clamps pages and limits artwork cards to four upcoming tracks", async () => {
    let payload;
    await sendQueueList(
        {
            update: async (value) => {
                payload = value;
            },
        },
        queue(),
        900,
        true,
    );
    assert.match(payload.embeds[0].data.footer.text, /Page 4 of 4/);
    assert.equal(payload.embeds.length, 2);
    assert.equal(payload.components[0].components[1].data.disabled, true);
});

test("volume modal rechecks current voice membership before changing playback", async () => {
    const player = queue();
    player.voiceChannel = { id: "voice" };
    let changed = false,
        reply;
    player.setVolume = async () => {
        changed = true;
    };
    const interaction = {
        guildId: "guild",
        member: { voice: { channel: { id: "other-voice" } } },
        client: { distube: { getQueue: () => player } },
        reply: async (value) => {
            reply = value;
        },
    };
    await handleMusicModal(interaction);
    assert.equal(changed, false);
    assert.equal(reply.ephemeral, true);
});
