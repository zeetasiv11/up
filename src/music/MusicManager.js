const { EventEmitter } = require("node:events");
const { AsyncLocalStorage } = require("node:async_hooks");
const { MusicQueue, trackView } = require("./PlayerManager.js");
const { resolve, validateTracks } = require("./TrackResolver.js");
class MusicManager extends EventEmitter {
    constructor({ client, lavalink, panels, settings, repository, history, logger }) {
        super();
        Object.assign(this, { client, lavalink, panels, settings, repository, history, logger });
        this.queues = new Map();
        this.locks = new Map();
        this.actors = new AsyncLocalStorage();
        this.recoveries = new Map();
        this.idleTimers = new Map();
        this.suspended = new Set();
        this.joining = new Map();
        this.interval = setInterval(() => {
            for (const queue of this.queues.values())
                if (queue.songs.length && !queue.paused && !queue.recovering)
                    void this.notify(queue).catch(() => this.logger.warn("[PANEL] Progress update failed"));
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
    getPanelUrl(guildId) {
        return this.panels.getUrl?.(guildId) || null;
    }
    withMember(member, fn) {
        return this.actors.run(member, fn);
    }
    assertMember(member, voiceChannel) {
        if (
            !member?.voice?.channel ||
            member.voice.channel.id !== voiceChannel.id ||
            (member.guild && member.guild.id !== voiceChannel.guild.id)
        )
            throw new Error("Join voice channel yang sama dengan bot terlebih dahulu.");
        const dj = this.settings.music.djRoleId;
        if (dj && !member.roles?.cache?.has(dj) && !member.permissions?.has("ManageGuild"))
            throw new Error("Role DJ diperlukan.");
        if (!voiceChannel.permissionsFor(voiceChannel.guild.members.me)?.has(["Connect", "Speak"]))
            throw new Error("Bot membutuhkan Connect dan Speak.");
        const botVoice = voiceChannel.guild.members.me?.voice;
        if (
            botVoice &&
            botVoice.channelId !== voiceChannel.id &&
            !(this.getQueue(voiceChannel.guild.id)?.recovering && !botVoice.channelId)
        )
            throw new Error("Koneksi voice bot berubah. Gunakan /play lagi.");
    }
    assertCurrent(queue) {
        if (
            this.closing ||
            this.getQueue(queue.id) !== queue ||
            queue.destroyed ||
            queue.recovering ||
            (this.lavalink.players && this.lavalink.players.get(queue.id) !== queue.player)
        )
            throw new Error("Player sudah tidak aktif. Gunakan /play lagi.");
    }
    runCurrent(queue, fn) {
        const member = this.actors.getStore();
        return this.run(queue.id, () => {
            this.assertCurrent(queue);
            if (member) this.assertMember(member, queue.voiceChannel);
            return fn();
        });
    }
    is247(guildId) {
        return Boolean(this.repository.getGuild(guildId).musicMode247);
    }
    isPersistent(guildId) {
        const config = this.repository.getGuild(guildId);
        return Boolean(config.musicMode247 || config.vcGuard?.enabled);
    }
    resolve(input) {
        return resolve(this.lavalink, input);
    }
    async notify(queue, panelOptions) {
        if (this.getQueue(queue.id) !== queue || queue.destroyed) return null;
        try {
            this.emit("change", queue.id);
        } catch {
            this.logger.warn(`[MUSIC] State listener failed (${queue.id})`);
        }
        if (!this.closing) {
            try {
                this.saveState(queue);
            } catch (error) {
                this.logger.error(`[MUSIC] State persistence failed (${queue.id})`);
            }
        }
        return this.panels.update(queue, undefined, undefined, panelOptions);
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
                suspended: this.suspended.has(queue.id),
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
                !this.isPersistent(id) ||
                state?.suspended ||
                this.suspended.has(id) ||
                (!state?.voiceChannelId && !config.vcGuard?.channelId) ||
                (state && Date.now() - state.updatedAt > 86400000)
            )
                continue;
            try {
                await this.run(id, async () => {
                    if (
                        this.closing ||
                        this.getQueue(id) ||
                        this.suspended.has(id) ||
                        this.recoveries.has(id) ||
                        !this.isPersistent(id)
                    )
                        return;
                    const voice = await guild.channels.fetch(
                        state?.voiceChannelId || config.vcGuard.channelId,
                    );
                    if (
                        !voice?.isVoiceBased() ||
                        !voice.permissionsFor(guild.members.me)?.has(["Connect", "Speak"])
                    )
                        return;
                    const textId = state?.textChannelId || config.vcGuard?.textChannelId;
                    const text = textId ? await guild.channels.fetch(textId) : null;
                    if (this.suspended.has(id) || this.closing || !this.isPersistent(id)) return;
                    try {
                        const queue = await this.connect(voice, text);
                        if (state) await this.applyState(queue, state);
                        else await this.notify(queue);
                        this.logger.info(`[247] Restored guild ${id}`);
                    } catch (error) {
                        await this.disconnect(id, { preserveState: true });
                        throw error;
                    }
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
        return q ? this.notify(q, { moveToBottom: true }) : Promise.resolve(null);
    }
    restoreMusicPanels() {
        return this.panels.restore();
    }
    async connect(voiceChannel, textChannel) {
        const guildId = voiceChannel?.guild?.id;
        if (!guildId) throw new Error("Voice channel tidak valid.");
        const pending = this.joining.get(guildId);
        if (pending) {
            const queue = await pending;
            if (queue.voiceChannel.id !== voiceChannel.id)
                throw new Error("Bot berada di voice channel lain.");
            return queue;
        }
        const joining = this.createOrReuse(voiceChannel, textChannel);
        this.joining.set(guildId, joining);
        try {
            return await joining;
        } finally {
            if (this.joining.get(guildId) === joining) this.joining.delete(guildId);
        }
    }
    async createOrReuse(voiceChannel, textChannel) {
        if (
            this.closing ||
            !voiceChannel?.guild ||
            (voiceChannel.isVoiceBased && !voiceChannel.isVoiceBased()) ||
            !voiceChannel.permissionsFor(voiceChannel.guild.members.me)?.has(["Connect", "Speak"])
        )
            throw new Error("Voice channel tidak valid atau izin Connect/Speak tidak tersedia.");
        if (!this.lavalink.getIdealNode()) throw new Error("Music node sedang tidak tersedia.");
        let queue = this.queues.get(voiceChannel.guild.id);
        if (queue) {
            this.assertCurrent(queue);
            if (queue.voiceChannel.id !== voiceChannel.id)
                throw new Error(`Bot berada di <#${queue.voiceChannel.id}>.`);
            queue.textChannel ||= textChannel;
            this.logger.info(`[PLAYER] Existing player reused (${queue.id})`);
            return queue;
        }
        // Remove orphaned library state before the single manager creates a player.
        if (
            this.lavalink.players?.has(voiceChannel.guild.id) ||
            this.lavalink.connections?.has(voiceChannel.guild.id)
        )
            await this.lavalink.leaveVoiceChannel(voiceChannel.guild.id);
        let player;
        try {
            player = await this.lavalink.joinVoiceChannel({
                guildId: voiceChannel.guild.id,
                channelId: voiceChannel.id,
                shardId: voiceChannel.guild.shardId || 0,
                deaf: true,
            });
        } catch (error) {
            await this.lavalink.leaveVoiceChannel(voiceChannel.guild.id).catch(() => {});
            // Shoukaku removes a timed-out connection from its registry before it
            // can be left. Explicitly release any partial Discord voice handshake.
            this.lavalink.connector?.sendPacket(voiceChannel.guild.shardId || 0, {
                op: 4,
                d: { guild_id: voiceChannel.guild.id, channel_id: null, self_deaf: true, self_mute: false },
            });
            throw error;
        }
        if (this.closing || this.suspended.has(voiceChannel.guild.id)) {
            await this.lavalink.leaveVoiceChannel(voiceChannel.guild.id);
            throw new Error("Voice connection dibatalkan.");
        }
        queue = new MusicQueue(this, player, voiceChannel, textChannel);
        this.queues.set(queue.id, queue);
        this.bindPlayer(queue);
        try {
            await player.setGlobalVolume(queue.volume);
        } catch (error) {
            this.queues.delete(queue.id);
            await this.lavalink.leaveVoiceChannel(queue.id).catch(() => {});
            throw error;
        }
        this.logger.info(`[VOICE] Connected (${queue.id})`);
        return queue;
    }
    bindPlayer(queue) {
        const dispatch = (event, fn) => {
            const song = queue.songs[0],
                epoch = queue.epoch;
            if (
                !song ||
                event.track?.encoded !== song.encoded ||
                (event.track.userData?.playId && event.track.userData.playId !== queue.playId)
            )
                return;
            void this.run(queue.id, async () => {
                if (
                    this.getQueue(queue.id) !== queue ||
                    queue.destroyed ||
                    queue.recovering ||
                    queue.songs[0] !== song ||
                    queue.epoch !== epoch
                )
                    return;
                await fn();
            }).catch(() => this.logger.error(`[PLAYER] Event handling failed (${queue.id})`));
        };
        queue.player.on("start", (event) => dispatch(event, () => this.notify(queue)));
        queue.player.on("end", (event) => {
            if (["finished", "loadFailed"].includes(event.reason))
                dispatch(event, () => queue.advance(event.reason === "loadFailed"));
        });
        for (const type of ["exception", "stuck"])
            queue.player.on(type, (event) => {
                this.logger.warn(`[PLAYER] Track ${type} (${queue.id})`);
                dispatch(event, () => queue.advance(true));
            });
        queue.player.on("closed", () => {
            if (this.getQueue(queue.id) === queue) this.handleVoiceDisconnect(queue.id);
        });
        queue.player.on("resumed", () => {
            if (this.getQueue(queue.id) === queue)
                void this.notify(queue).catch(() => this.logger.warn("[PANEL] Resume update failed"));
        });
    }
    async play(voiceChannel, input, options = {}) {
        const result = await this.resolve(input);
        const tracks = result.type === "search" ? result.tracks.slice(0, 1) : result.tracks;
        return this.enqueue(voiceChannel, tracks, options);
    }
    enqueue(voiceChannel, tracks, { textChannel, member, position } = {}) {
        return this.run(voiceChannel.guild.id, async () => {
            if (this.closing) throw new Error("Music service sedang berhenti.");
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
            let existing = this.queues.get(voiceChannel.guild.id);
            if (
                existing &&
                this.lavalink.players &&
                this.lavalink.players.get(existing.id) !== existing.player &&
                !existing.recovering
            ) {
                await this.disconnect(existing.id);
                existing = null;
            }
            if (existing) this.assertCurrent(existing);
            validateTracks(tracks);
            if (
                !tracks.length ||
                (existing?.songs.length || 0) + tracks.length > this.settings.music.maxQueueSize
            )
                throw new Error("Antrian kosong atau melebihi batas.");
            const songs = tracks.map((track) => trackView(track, member.user));
            this.suspended.delete(voiceChannel.guild.id);
            this.cancelRecovery(voiceChannel.guild.id);
            this.clearIdleTimer(voiceChannel.guild.id);
            const queue = await this.connect(voiceChannel, textChannel);
            const idle = queue.songs.length === 0;
            try {
                this.assertMember(member, voiceChannel);
                if (textChannel?.guildId === queue.id && textChannel.isTextBased?.())
                    queue.textChannel = textChannel;
                queue.songs.splice(position === 1 && !idle ? 1 : queue.songs.length, 0, ...songs);
                if (idle) await queue.start();
                else await this.notify(queue, { moveToBottom: true });
            } catch (error) {
                if (idle) {
                    this.suspend(queue.id);
                    await this.disconnect(queue.id);
                }
                throw error;
            }
            this.logger.info(`[QUEUE] ${songs.length} track(s) added (${queue.id})`);
            return songs.length;
        });
    }
    async disconnect(guildId, { preserveState = false } = {}) {
        const queue = this.queues.get(guildId);
        this.clearIdleTimer(guildId);
        this.queues.delete(guildId);
        if (queue) queue.destroyed = true;
        await this.lavalink.leaveVoiceChannel(guildId);
        if (queue) {
            if (!preserveState && !this.closing) {
                queue.songs = [];
                this.saveState(queue);
            }
            try {
                this.emit("change", guildId);
            } catch {
                this.logger.warn(`[MUSIC] State listener failed (${guildId})`);
            }
            await this.panels.update(queue, null);
        }
        this.logger.info(`[VOICE] Disconnected (${guildId})`);
    }
    leave(guildId) {
        const member = this.actors.getStore(),
            queue = this.getQueue(guildId);
        if (member && queue) this.assertMember(member, queue.voiceChannel);
        this.suspend(guildId);
        return this.run(guildId, () => {
            if (member && this.getQueue(guildId))
                this.assertMember(member, this.getQueue(guildId).voiceChannel);
            return this.disconnect(guildId);
        });
    }
    suspend(guildId) {
        this.suspended.add(guildId);
        this.cancelRecovery(guildId);
        this.clearIdleTimer(guildId);
        const state = this.repository.getGuild(guildId).musicState;
        if (!this.closing && this.repository.updateGuild)
            this.repository.updateGuild(guildId, { musicState: { ...state, suspended: true } });
    }
    cancelRecovery(guildId) {
        const job = this.recoveries.get(guildId);
        if (job) clearTimeout(job.timer);
        this.recoveries.delete(guildId);
    }
    clearIdleTimer(guildId, type) {
        const timers = this.idleTimers.get(guildId);
        if (!timers) return;
        for (const [kind, timer] of timers) {
            if (type && kind !== type) continue;
            clearTimeout(timer);
            timers.delete(kind);
        }
        if (!timers.size) this.idleTimers.delete(guildId);
    }
    checkEmpty(guildId) {
        const queue = this.getQueue(guildId);
        const empty = () => queue.voiceChannel.members?.filter((member) => !member.user.bot).size === 0;
        if (!queue || this.isPersistent(guildId) || !this.settings.music.leaveOnEmpty || !empty()) {
            this.clearIdleTimer(guildId, "empty");
            return;
        }
        this.scheduleIdle(queue, empty, this.settings.music.leaveOnEmptyCooldown, "empty");
    }
    scheduleIdle(queue, condition, seconds = 60, type = "finish") {
        if (this.idleTimers.get(queue.id)?.has(type) || this.isPersistent(queue.id)) return;
        const timers = this.idleTimers.get(queue.id) || new Map();
        const timer = setTimeout(
            () => {
                timers.delete(type);
                if (!timers.size) this.idleTimers.delete(queue.id);
                void this.run(queue.id, async () => {
                    if (this.getQueue(queue.id) !== queue || this.isPersistent(queue.id) || !condition())
                        return;
                    this.suspend(queue.id);
                    await this.disconnect(queue.id);
                }).catch(() => this.logger.warn(`[VOICE] Idle cleanup failed (${queue.id})`));
            },
            Math.max(0, Number(seconds) || 0) * 1000,
        );
        timer.unref();
        timers.set(type, timer);
        this.idleTimers.set(queue.id, timers);
    }
    policyChanged(guildId) {
        if (!this.isPersistent(guildId)) {
            this.cancelRecovery(guildId);
            const queue = this.getQueue(guildId);
            if (queue?.recovering) void this.withMember(null, () => this.leave(guildId)).catch(() => {});
            else if (queue && !queue.songs.length && this.settings.music.leaveOnFinish)
                this.scheduleIdle(
                    queue,
                    () => !queue.songs.length,
                    this.settings.music.leaveOnFinishCooldown,
                );
        } else this.clearIdleTimer(guildId);
        this.checkEmpty(guildId);
    }
    async startGuard(guild, channelId, textChannelId) {
        return this.run(guild.id, async () => {
            const voice = await guild.channels.fetch(channelId);
            const text = textChannelId ? await guild.channels.fetch(textChannelId) : null;
            const existing = this.getQueue(guild.id);
            if (existing) this.assertCurrent(existing);
            this.suspended.delete(guild.id);
            this.cancelRecovery(guild.id);
            const queue = await this.connect(voice, text);
            this.repository.updateGuild(guild.id, {
                vcGuard: { enabled: true, channelId, textChannelId: textChannelId || "" },
            });
            this.clearIdleTimer(guild.id);
            await this.notify(queue);
            return queue.player;
        });
    }
    stopGuard(guildId) {
        const enabled = Boolean(this.repository.getGuild(guildId).vcGuard?.enabled);
        this.repository.updateGuild(guildId, {
            vcGuard: { enabled: false, channelId: "", textChannelId: "" },
        });
        return this.withMember(null, () => this.leave(guildId)).then(() => enabled);
    }
    snapshot(queue) {
        return {
            songs: [...queue.songs],
            position: queue.currentTime,
            paused: queue.paused,
            volume: queue.volume,
            repeatMode: queue.repeatMode,
            autoplay: queue.autoplay,
            filters: [...queue.filters.active.keys()],
            previousSongs: [...queue.previousSongs],
        };
    }
    async applyState(queue, state) {
        queue.songs = Array.isArray(state.songs) ? state.songs : [];
        if (queue.songs.some((song) => !song?.encoded || !Number.isFinite(song.duration)))
            throw new Error("Saved tracks tidak valid.");
        queue.previousSongs = state.previousSongs || [];
        queue.repeatMode = [0, 1, 2].includes(state.repeatMode) ? state.repeatMode : 0;
        queue.autoplay = Boolean(state.autoplay);
        queue.volume =
            Number.isInteger(state.volume) && state.volume >= 0 && state.volume <= 150
                ? state.volume
                : this.settings.music.defaultVolume;
        await queue.player.setGlobalVolume(queue.volume);
        const presets = require("./AudioFilters").PRESETS;
        await queue.filters.apply(
            new Map(
                (state.filters || [])
                    .filter((name) => queue.filters.supports(name))
                    .map((name) => [name, presets[name]]),
            ),
        );
        if (queue.songs.length) {
            await queue.start();
            if (!queue.songs[0].isLive && Number.isFinite(state.position))
                await queue.player.seekTo(
                    Math.max(0, Math.min(state.position, queue.songs[0].duration)) * 1000,
                );
            if (state.paused) await queue.player.setPaused(true);
        }
        await this.notify(queue);
    }
    handleVoiceDisconnect(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || this.closing || this.suspended.has(guildId) || queue.destroyed) return;
        if (this.isPersistent(guildId)) this.scheduleRecovery(queue);
        else {
            queue.recovering = true;
            void this.run(guildId, () =>
                this.getQueue(guildId) === queue ? this.disconnect(guildId) : undefined,
            ).catch(() => this.logger.warn("[VOICE] Cleanup failed"));
        }
    }
    scheduleRecovery(queue) {
        if (
            this.closing ||
            this.suspended.has(queue.id) ||
            !this.isPersistent(queue.id) ||
            this.recoveries.has(queue.id)
        )
            return;
        const job = { queue, state: this.snapshot(queue), attempt: 0 };
        queue.recovering = true;
        this.recoveries.set(queue.id, job);
        const active = () =>
            this.recoveries.get(queue.id) === job &&
            !this.closing &&
            !this.suspended.has(queue.id) &&
            this.isPersistent(queue.id);
        const retry = () => {
            if (!active()) return;
            if (job.attempt >= 5) {
                this.cancelRecovery(queue.id);
                void this.leave(queue.id).catch(() => {});
                this.logger.warn(`[247] Recovery attempts exhausted (${queue.id})`);
                return;
            }
            job.attempt++;
            job.timer = setTimeout(
                () => {
                    void this.run(queue.id, async () => {
                        if (!active()) return;
                        if (!this.lavalink.getIdealNode()) throw new Error("Node unavailable");
                        await this.disconnect(queue.id, { preserveState: true });
                        if (!active()) return;
                        const replacement = await this.connect(queue.voiceChannel, queue.textChannel);
                        if (!active()) {
                            await this.disconnect(queue.id, { preserveState: true });
                            return;
                        }
                        try {
                            await this.applyState(replacement, job.state);
                        } catch (error) {
                            await this.disconnect(queue.id, { preserveState: true });
                            throw error;
                        }
                        if (!active()) {
                            await this.disconnect(queue.id, { preserveState: true });
                            return;
                        }
                        this.cancelRecovery(queue.id);
                        this.logger.info(`[247] Voice recovered (${queue.id})`);
                    }).catch(() => {
                        this.logger.warn(`[247] Recovery attempt ${job.attempt} failed (${queue.id})`);
                        retry();
                    });
                },
                Math.min(30000, job.attempt * 5000),
            );
            job.timer.unref();
        };
        retry();
        void this.notify(queue).catch(() => {});
    }
    async reconcileNode() {
        for (const queue of this.queues.values()) {
            if (this.lavalink.players && this.lavalink.players.get(queue.id) !== queue.player)
                this.handleVoiceDisconnect(queue.id);
            else {
                queue.nodeUnavailable = false;
                await this.notify(queue);
            }
        }
        await this.restorePlayers();
    }
    nodeUnavailable(name) {
        for (const queue of this.queues.values()) {
            if (queue.player.node.name !== name) continue;
            queue.nodeUnavailable = true;
            void this.notify(queue).catch(() => {});
        }
    }
    async close() {
        for (const queue of this.queues.values()) {
            try {
                this.saveState(queue);
            } catch {
                this.logger.warn(`[MUSIC] Shutdown snapshot failed (${queue.id})`);
            }
        }
        this.closing = true;
        this.lavalink.musicClosing = true;
        clearInterval(this.interval);
        for (const id of this.recoveries.keys()) this.cancelRecovery(id);
        for (const id of this.idleTimers.keys()) this.clearIdleTimer(id);
        await Promise.allSettled(
            [...this.queues.keys()].map((id) =>
                this.run(id, () => this.disconnect(id, { preserveState: true })),
            ),
        );
        // Shoukaku reconnects even after removeNode closes its socket. Stop that
        // callback and bound any already-running connection retry during shutdown.
        this.lavalink.options && (this.lavalink.options.reconnectTries = 0);
        for (const [name, node] of this.lavalink.nodes) {
            node.ws?.removeAllListeners("close");
            this.lavalink.removeNode(name, "shutdown");
        }
    }
}
module.exports = { MusicManager };
