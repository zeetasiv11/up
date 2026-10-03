const { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows } = require("../../utils/musicPanel.js");
/** One active message per guild; move it only for requests and new playback. */
class MusicPanelUpdater {
    constructor(client, repository, logger) {
        this.client = client;
        this.repository = repository;
        this.logger = logger;
        this.panels = new Map();
        this.signatures = new Map();
        this.pending = new Map();
    }
    getUrl(guildId) {
        return this.panels.get(guildId)?.url || null;
    }
    async update(queue, song = queue?.songs?.[0], reason, { moveToBottom = false } = {}) {
        const guildId = queue?.id || queue?.textChannel?.guildId;
        if (!guildId) return null;
        let pending = this.pending.get(guildId);
        if (pending) {
            Object.assign(pending, { queue, song, reason, dirty: true });
            pending.moveToBottom ||= moveToBottom;
            return pending.promise;
        }
        pending = { queue, song, reason, moveToBottom, dirty: true };
        this.pending.set(guildId, pending);
        pending.promise = (async () => {
            let panel;
            do {
                await new Promise((resolve) => setTimeout(resolve, 250));
                pending.dirty = false;
                const move = pending.moveToBottom;
                pending.moveToBottom = false;
                try {
                    panel = await this.write(guildId, pending.queue, pending.song, pending.reason, move);
                } catch (error) {
                    this.logger.warn(`[PANEL] Update failed (${guildId}, code ${error.code || "unknown"})`);
                }
            } while (pending.dirty);
            return panel || null;
        })().finally(() => this.pending.delete(guildId));
        return pending.promise;
    }
    async write(guildId, queue, song, reason, moveToBottom = false) {
        const saved = this.repository.getGuild(guildId).musicPanel;
        let panel = this.panels.get(guildId),
            channel = queue?.textChannel || panel?.channel;
        if (!panel && saved?.channelId) {
            try {
                channel = await this.client.channels.fetch(saved.channelId);
            } catch (error) {
                if (error.code !== 10003) throw error;
            }
            if (channel?.messages && saved.messageId) {
                try {
                    panel = await channel.messages.fetch(saved.messageId);
                } catch (error) {
                    if (error.code !== 10008) throw error;
                }
            }
        }
        if (panel && panel.author?.id !== this.client.user.id)
            throw new Error("Saved music panel belongs to another user");
        if (channel?.guildId !== guildId)
            throw new Error("Music panel channel does not belong to this guild");
        if (!channel?.isTextBased?.()) return null;
        // Read authoritative state after Discord fetches and debounce, never a captured old song.
        if (this.client.music) {
            queue = this.client.music.getQueue(guildId);
            song = queue?.songs[0];
        } else if (song !== null) song = queue?.songs?.[0];
        if (moveToBottom && song) {
            channel = queue?.textChannel || channel;
            if (channel?.guildId !== guildId || !channel?.isTextBased?.())
                throw new Error("Invalid music panel destination");
            if (panel) {
                try {
                    await panel.delete();
                } catch (error) {
                    // Never create a second control panel when deletion is uncertain.
                    if (error.code !== 10008) throw error;
                }
                this.forget(guildId);
                this.repository.updateGuild(guildId, { musicPanel: null });
                panel = null;
            }
        }
        const payload = {
            embeds: [song ? buildNowPlayingEmbed(queue, song) : buildIdleMusicEmbed(reason)],
            components: buildControlRows(song ? queue : null),
            allowedMentions: { parse: [] },
        };
        const fallback =
            song && !require("../../utils/musicPanel.js").safeUrl(song.thumbnail)
                ? require("./FallbackArtwork").fallbackArtwork(song.name, song.artist)
                : null;
        if (fallback) payload.embeds[0].setImage(`attachment://${fallback.name}`);
        const signature = JSON.stringify(payload);
        if (
            fallback &&
            (!panel || !panel.attachments?.some?.((attachment) => attachment.name === fallback.name))
        ) {
            payload.files = [fallback];
            payload.attachments = [];
        } else if (!fallback) payload.attachments = [];
        if (panel && this.signatures.get(guildId) === signature) return panel;
        if (panel) {
            try {
                await panel.edit(payload);
            } catch (error) {
                if (error.code !== 10008) throw error;
                panel = null;
            }
        }
        if (!panel) {
            panel = await channel.send(payload);
            // Keep the message identity even when persistence is temporarily unavailable.
            this.panels.set(guildId, panel);
            this.repository.updateGuild(guildId, {
                musicPanel: { channelId: panel.channelId, messageId: panel.id },
            });
        }
        await this.repository.flush?.();
        this.panels.set(guildId, panel);
        this.signatures.set(guildId, signature);
        this.logger.info(`[PANEL] State updated (${guildId})`);
        return panel;
    }
    forget(guildId) {
        this.panels.delete(guildId);
        this.signatures.delete(guildId);
    }
    async restore() {
        for (const [id, config] of Object.entries(this.repository.getDB().guilds)) {
            if (config.musicPanel && this.client.guilds.cache.has(id))
                await this.update(this.client.music?.getQueue(id) || { id });
        }
    }
}
module.exports = { MusicPanelUpdater };
