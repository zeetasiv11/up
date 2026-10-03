const { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows } = require("../../utils/musicPanel.js");
/** One stable message per guild. Transient Discord failures never create another panel. */
class MusicPanelUpdater {
    constructor(client, repository, logger) {
        this.client = client;
        this.repository = repository;
        this.logger = logger;
        this.panels = new Map();
        this.locks = new Map();
        this.signatures = new Map();
    }
    async update(queue, song = queue?.songs?.[0], reason) {
        const guildId = queue?.id || queue?.textChannel?.guildId;
        if (!guildId) return null;
        const previous = this.locks.get(guildId) || Promise.resolve();
        const current = previous.catch(() => {}).then(() => this.write(guildId, queue, song, reason));
        this.locks.set(guildId, current);
        try {
            return await current;
        } catch (error) {
            this.logger.error(`Music panel update failed (${guildId}): ${error.message}`);
            return null;
        } finally {
            if (this.locks.get(guildId) === current) this.locks.delete(guildId);
        }
    }
    async write(guildId, queue, song, reason) {
        const saved = this.repository.getGuild(guildId).musicPanel;
        let panel = this.panels.get(guildId),
            channel = queue?.textChannel;
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
            this.repository.updateGuild(guildId, {
                musicPanel: { channelId: panel.channelId, messageId: panel.id },
            });
        }
        await this.repository.flush?.();
        this.panels.set(guildId, panel);
        this.signatures.set(guildId, signature);
        return panel;
    }
    forget(guildId) {
        this.panels.delete(guildId);
        this.signatures.delete(guildId);
    }
    async restore() {
        for (const [id, config] of Object.entries(this.repository.getDB().guilds)) {
            if (config.musicPanel && this.client.guilds.cache.has(id)) await this.update({ id }, null);
        }
    }
}
module.exports = { MusicPanelUpdater };
