const { EventEmitter } = require("node:events");
const { MusicQueue, trackView } = require("./PlayerManager.js");
const { resolve } = require("./TrackResolver.js");
class MusicManager extends EventEmitter {
    constructor({ client, lavalink, panels, settings, repository, history, logger }) {
        super();
        Object.assign(this, { client, lavalink, panels, settings, repository, history, logger });
        this.queues = new Map();
        this.locks = new Map();
        this.interval = setInterval(() => {
            for (const queue of this.queues.values())
                if (queue.songs.length && !queue.paused) void this.notify(queue);
        }, 15000);
        this.interval.unref();
    }
    async run(guildId, fn) {
        const previous = this.locks.get(guildId) || Promise.resolve();
        const current = previous.catch(() => {}).then(fn);
        this.locks.set(guildId, current);
        try {
            return await current;
        } finally {
            if (this.locks.get(guildId) === current) this.locks.delete(guildId);
        }
    }
    getQueue(guildId) {
        return this.queues.get(guildId) || null;
    }
    is247(guildId) {
        return Boolean(this.repository.getGuild(guildId).musicMode247);
    }
    resolve(input) {
        return resolve(this.lavalink, input);
    }
    async notify(queue) {
        this.emit("change", queue.id);
        if (!this.closing) {
            try {
                this.saveState(queue);
            } catch (error) {
                this.logger.error(`Music state persistence failed: ${error.message}`);
            }
        }
        return this.panels.update(queue);
    }
    saveState(queue) {
        if (!this.repository.updateGuild) return;
        const songs = queue.songs.map((song) => ({
            ...song,
            user: song.user ? { id: song.user.id, username: song.user.username } : null,
        }));
        this.repository.updateGuild(queue.id, {
            musicState: {
                voiceChannelId: queue.voiceChannel.id,
                textChannelId: queue.textChannel?.id || null,
                songs,
                position: queue.currentTime,
                volume: queue.volume,
                repeatMode: queue.repeatMode,
                autoplay: queue.autoplay,
                paused: queue.paused,
                filters: [...queue.filters.active.keys()],
                updatedAt: Date.now(),
            },
        });
    }
    async restorePlayers() {
        if (!this.repository.getDB) return;
        for (const [id, config] of Object.entries(this.repository.getDB().guilds)) {
            const state = config.musicState,
                guild = this.client.guilds.cache.get(id);
            if (
                !guild ||
                !state?.voiceChannelId ||
                !state.songs?.length ||
                Date.now() - state.updatedAt > 86400000
            )
                continue;
            try {
                await this.run(id, async () => {
                    if (this.getQueue(id)?.songs.length) return;
                    const voice = await guild.channels.fetch(state.voiceChannelId);
                    if (
                        !voice?.isVoiceBased() ||
                        !voice.permissionsFor(guild.members.me)?.has(["Connect", "Speak"])
                    )
                        return;
                    const text = state.textChannelId ? await guild.channels.fetch(state.textChannelId) : null;
                    const queue = await this.connect(voice, text);
                    queue.songs = state.songs;
                    queue.repeatMode = state.repeatMode;
                    queue.autoplay = state.autoplay;
                    await queue.player.setGlobalVolume(state.volume);
                    queue.volume = state.volume;
                    await queue.start();
                    const presets = require("./AudioFilters").PRESETS;
                    await queue.filters.apply(
                        new Map(
                            (state.filters || [])
                                .filter((name) => queue.filters.supports(name))
                                .map((name) => [name, presets[name]]),
                        ),
                    );
                    if (!queue.songs[0].isLive)
                        await queue.player.seekTo(Math.min(state.position, queue.songs[0].duration) * 1000);
                    if (state.paused) await queue.player.setPaused(true);
                    await this.notify(queue);
                });
            } catch (error) {
                this.logger.warn(`Player restore failed (${id}): ${error.message}`);
            }
        }
    }
    updateMusicPanel(queue) {
        return this.notify(queue);
    }
    reanchorMusicPanel(guildId) {
        const q = this.queues.get(guildId);
        return q ? this.notify(q) : Promise.resolve(null);
    }
    restoreMusicPanels() {
        return this.panels.restore();
    }
    async connect(voiceChannel, textChannel) {
        let queue = this.queues.get(voiceChannel.guild.id);
        if (queue) {
            if (queue.voiceChannel.id !== voiceChannel.id)
                throw new Error(`Bot berada di <#${queue.voiceChannel.id}>.`);
            queue.textChannel ||= textChannel;
            return queue;
        }
        const player = await this.lavalink.joinVoiceChannel({
            guildId: voiceChannel.guild.id,
            channelId: voiceChannel.id,
            shardId: voiceChannel.guild.shardId || 0,
            deaf: true,
        });
        queue = new MusicQueue(this, player, voiceChannel, textChannel);
        this.queues.set(queue.id, queue);
        player.on("end", (event) => {
            if (["finished", "loadFailed"].includes(event.reason))
                this.run(queue.id, () =>
                    event.track?.encoded === queue.songs[0]?.encoded
                        ? queue.advance(event.reason === "loadFailed")
                        : undefined,
                ).catch((error) => this.logger.error(`Music advance failed: ${error.message}`));
        });
        player.on("exception", (event) =>
            this.logger.error(`Track failed (${queue.id}): ${event.exception?.message || "unknown"}`),
        );
        player.on("stuck", () => queue.skip().catch((error) => this.logger.error(error.message)));
        try {
            await player.setGlobalVolume(queue.volume);
        } catch (error) {
            this.queues.delete(queue.id);
            await this.lavalink.leaveVoiceChannel(queue.id).catch(() => {});
            throw error;
        }
        return queue;
    }
    async play(voiceChannel, input, options = {}) {
        const result = await this.resolve(input);
        const tracks = result.type === "search" ? result.tracks.slice(0, 1) : result.tracks;
        return this.enqueue(voiceChannel, tracks, options);
    }
    enqueue(voiceChannel, tracks, { textChannel, member, position } = {}) {
        return this.run(voiceChannel.guild.id, async () => {
            if (
                this.settings.music.djRoleId &&
                !member?.roles?.cache?.has(this.settings.music.djRoleId) &&
                !member?.permissions?.has("ManageGuild")
            )
                throw new Error("Role DJ diperlukan.");
            if (!member?.voice?.channel || member.voice.channel.id !== voiceChannel.id)
                throw new Error("Join voice channel terlebih dahulu.");
            if (!voiceChannel.permissionsFor(voiceChannel.guild.members.me)?.has(["Connect", "Speak"]))
                throw new Error("Bot membutuhkan Connect dan Speak.");
            const existing = this.queues.get(voiceChannel.guild.id);
            if (
                !tracks.length ||
                (existing?.songs.length || 0) + tracks.length > this.settings.music.maxQueueSize
            )
                throw new Error("Antrian kosong atau melebihi batas.");
            const queue = await this.connect(voiceChannel, textChannel);
            const idle = queue.songs.length === 0;
            const songs = tracks.map((track) => trackView(track, member.user));
            queue.songs.splice(position === 1 && !idle ? 1 : queue.songs.length, 0, ...songs);
            try {
                if (idle) await queue.start();
                else await this.notify(queue);
            } catch (error) {
                if (idle) queue.songs = [];
                throw error;
            }
            return songs.length;
        });
    }
    async disconnect(guildId) {
        await this.lavalink.leaveVoiceChannel(guildId);
        const queue = this.queues.get(guildId);
        if (queue) {
            queue.songs = [];
            await this.notify(queue);
            this.queues.delete(guildId);
        }
    }
    leave(guildId) {
        return this.run(guildId, () => this.disconnect(guildId));
    }
    async close() {
        for (const queue of this.queues.values()) this.saveState(queue);
        this.closing = true;
        clearInterval(this.interval);
        await Promise.allSettled([...this.queues.keys()].map((id) => this.leave(id)));
        for (const name of this.lavalink.nodes.keys()) this.lavalink.removeNode(name, "shutdown");
    }
}
module.exports = { MusicManager };
