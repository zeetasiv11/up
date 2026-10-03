const { EventEmitter } = require("node:events");
const { MusicManager } = require("../src/music/MusicManager.js");
const { silent } = require("./helpers.cjs");
const track = (n) => ({
    encoded: `encoded-${n}`,
    info: {
        title: `Track ${n}`,
        author: "Artist",
        uri: `https://youtube.com/watch?v=${n}`,
        length: 240000,
        isStream: false,
        sourceName: "youtube",
    },
});
function fixture(options = {}) {
    const node = {
        name: "primary",
        state: 1,
        info: {
            filters: [
                "equalizer",
                "timescale",
                "rotation",
                "karaoke",
                "tremolo",
                "vibrato",
                "lowPass",
                "distortion",
            ],
        },
        rest: { resolve: async () => ({ loadType: "search", data: [track(1), track(2), track(3)] }) },
    };
    const players = new Map();
    const lavalink = {
        nodes: new Map(),
        players,
        joins: 0,
        getIdealNode: () => (node.available === false ? null : node),
        joinVoiceChannel: async ({ guildId }) => {
            lavalink.joins++;
            if (players.has(guildId)) throw new Error("duplicate player");
            const player = Object.assign(new EventEmitter(), {
                node,
                position: 0,
                paused: false,
                playTrack: async (options) => {
                    player.track = options.track.encoded;
                    player.position = 0;
                    player.paused = options.paused ?? false;
                    player.userData = options.track.userData;
                },
                update: async (options, noReplace = false) => {
                    if (!noReplace) player.paused = false;
                    if (typeof options.paused === "boolean") player.paused = options.paused;
                    if (typeof options.volume === "number") player.volume = options.volume;
                    if (typeof options.position === "number") player.position = options.position;
                    if (options.filters) player.filters = { ...player.filters, ...options.filters };
                },
                stopTrack: async () => {
                    player.track = null;
                },
                setGlobalVolume: async (value) => {
                    player.volume = value;
                },
                setPaused: async (value) => {
                    player.paused = value;
                },
                seekTo: async (value) => {
                    player.position = value;
                },
                setFilters: async (value) => {
                    player.filters = value;
                },
            });
            players.set(guildId, player);
            return player;
        },
        leaveVoiceChannel: async (id) => {
            players.delete(id);
        },
    };
    const data = {};
    const repository = {
        getGuild: (id) => (data[id] ||= { musicMode247: false }),
        updateGuild: (id, patch) => Object.assign(repository.getGuild(id), structuredClone(patch)),
        getDB: () => ({ guilds: data, stats: {} }),
    };
    const manager = new MusicManager({
        client: {},
        lavalink,
        panels: { update: async () => {} },
        settings: { music: { defaultVolume: 72, maxQueueSize: 3, leaveOnFinish: false, ...options } },
        repository,
        history() {},
        logger: silent,
    });
    const voice = (guildId) => ({
        id: `voice-${guildId}`,
        guild: { id: guildId, shardId: 0, members: { me: {} } },
        permissionsFor: () => ({ has: () => true }),
    });
    const member = (channel) => ({ voice: { channel }, user: { id: "requester", username: "listener" } });
    return { manager, players, voice, member, node, lavalink, data };
}

module.exports = { fixture, track };
