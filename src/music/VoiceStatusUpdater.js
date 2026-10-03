const { Routes } = require("discord.js");

/** Optional voice-channel decoration, driven by the authoritative music queue. */
class VoiceStatusUpdater {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
        this.guilds = new Map();
    }
    update(queue) {
        if (queue.loading) return Promise.resolve();
        const song = queue.songs[0];
        const label = queue.recovering || queue.nodeUnavailable
            ? "⌛ Reconnecting"
            : queue.paused ? "⏸ Paused" : "🎧 Playing";
        const status = song
            ? Array.from(`${label} • ${song.name}`.replace(/[\x00-\x1f\x7f]/g, " ")).slice(0, 240).join("")
            : null;
        return this.schedule(queue.id, status ? queue.voiceChannel : null, status);
    }
    clear(guildId) {
        return this.schedule(guildId, null, null);
    }
    schedule(guildId, channel, status) {
        if (!this.client.rest?.put) return Promise.resolve();
        let state = this.guilds.get(guildId);
        if (!state) {
            state = { owned: new Map(), retryAt: new Map(), desired: null, running: null };
            this.guilds.set(guildId, state);
        }
        state.desired = { channel, status };
        if (!state.running) state.running = this.drain(guildId, state);
        return state.running;
    }
    async drain(guildId, state) {
        // Publish the running promise before processing synchronous/no-op updates.
        await Promise.resolve();
        try {
            while (state.desired) {
                const { channel, status } = state.desired;
                state.desired = null;
                for (const owned of [...state.owned.values()]) {
                    if (owned.channel.id !== channel?.id)
                        await this.write(guildId, state, owned.channel, null);
                }
                if (channel && state.owned.get(channel.id)?.status !== status)
                    await this.write(guildId, state, channel, status);
            }
        } finally {
            state.running = null;
        }
    }
    async write(guildId, state, channel, status) {
        if (Date.now() < (state.retryAt.get(channel.id) || 0)) return;
        try {
            if (!channel.permissionsFor?.(channel.guild?.members?.me)?.has("SetVoiceChannelStatus"))
                throw Object.assign(new Error("Voice status permission missing"), { code: 50013 });
            await this.client.rest.put(Routes.channelVoiceStatus(channel.id), { body: { status } });
            if (status === null) state.owned.delete(channel.id);
            else state.owned.set(channel.id, { channel, status });
            state.retryAt.delete(channel.id);
        } catch (error) {
            // A missing permission or API outage must not interrupt playback or spam requests.
            state.retryAt.set(channel.id, Date.now() + 60000);
            this.logger.warn(`[VOICE] Status update unavailable (${guildId}, code ${error.code || "network"}); check Set Voice Channel Status permission`);
        }
    }
}

module.exports = { VoiceStatusUpdater };
