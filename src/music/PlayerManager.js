const { randomUUID } = require("node:crypto");
const { AudioFilters } = require("./AudioFilters.js");
const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0")}`;
const trackView = (track, user) => ({
    encoded: track.encoded,
    identifier: track.info.identifier || "",
    name: track.info.title,
    url: track.info.uri || "",
    artist: track.info.author,
    uploader: { name: track.info.author },
    duration: track.info.length / 1000,
    formattedDuration: track.info.isStream ? "LIVE" : formatTime(track.info.length / 1000),
    thumbnail: track.info.artworkUrl || "",
    isLive: track.info.isStream,
    user,
    source: track.info.sourceName,
});
// Share links and watch URLs for the same video must count as one history item.
function songIdentity(song) {
    try {
        const url = new URL(song.url);
        const host = url.hostname.replace(/^www\./, "");
        const videoId = host === "youtu.be" ? url.pathname.slice(1)
            : ["youtube.com", "music.youtube.com"].includes(host) ? url.searchParams.get("v") : null;
        if (videoId) return `youtube:${videoId}`;
        if (song.identifier) return `${song.source}:${song.identifier}`;
        return `${url.origin}${url.pathname}`;
    } catch {
        return `${song.source}:${song.identifier || song.encoded}`;
    }
}
class MusicQueue {
    constructor(manager, player, voiceChannel, textChannel) {
        this.manager = manager;
        this.player = player;
        this.id = voiceChannel.guild.id;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.songs = [];
        this.epoch = 0;
        this.previousSongs = [];
        this.repeatMode = 0;
        this.autoplay = false;
        this.autoplayFailures = 0;
        this.playbackFailed = false;
        this.volume = manager.settings.music.defaultVolume;
        this.filters = new AudioFilters(this);
        this.voice = { leave: () => manager.leave(this.id), channel: voiceChannel };
    }
    get paused() {
        return this.playbackFailed || this.player.paused;
    }
    get currentTime() {
        return Math.max(0, this.player.position / 1000);
    }
    get formattedCurrentTime() {
        return formatTime(this.currentTime);
    }
    run(fn) {
        return this.manager.runCurrent(this, fn);
    }
    updatePlayer(options) {
        // Shoukaku 4 resets its local paused flag unless noReplace is true.
        // Include pause state so REST and the local player keep the same state.
        return this.player.update({ paused: this.paused, ...options }, true);
    }
    remember(song) {
        this.previousSongs.push(song);
        this.previousSongs = this.previousSongs.slice(-50);
    }
    async start() {
        if (!this.songs[0]) return this.manager.notify(this);
        this.manager.clearIdleTimer(this.id, "finish");
        let lastError;
        // A bad track must not erase the rest of a playlist. Bound REST attempts
        // so a broken node cannot consume the whole queue or hold the guild lock forever.
        for (let attempt = 0; attempt < 3 && this.songs.length; attempt++) {
            if (this.manager.closing || this.manager.suspended.has(this.id))
                throw new Error("Playback dibatalkan.");
            const song = this.songs[0];
            this.epoch++;
            this.playId = randomUUID();
            this.loading = true;
            void this.manager.notify(this).catch(() => {});
            try {
                await this.player.playTrack({
                    track: { encoded: song.encoded, userData: { playId: this.playId } },
                    position: 0,
                    paused: false,
                });
            } catch (error) {
                lastError = error;
                this.epoch++;
                this.playId = null;
                this.playbackFailed = true;
                const nodeFailure = error.code === "LAVALINK_TIMEOUT" || error.status >= 500 ||
                    [401, 403, 404].includes(error.status);
                if (!nodeFailure) {
                    this.songs.shift();
                    this.remember(song);
                    if (song.autoplayGenerated) this.autoplayFailures++;
                }
                this.manager.logger.warn(`[PLAYER] Track start failed (${this.id})`, {
                    status: Number.isInteger(error.status) ? error.status : "unavailable",
                    code: error.code || error.name,
                    remaining: this.songs.length,
                });
                await this.player.stopTrack().catch(() => {});
                if (nodeFailure) break; // Preserve valid songs while the node is unavailable.
                continue;
            } finally {
                this.loading = false;
            }
            this.playbackFailed = false;
            this.manager.logger.info(`[PLAYER] Playback started (${this.id})`);
            try {
                this.manager.history(this.id, song);
            } catch {
                this.manager.logger.warn(`[MUSIC] History unavailable (${this.id})`);
            }
            await this.manager.notify(this, { moveToBottom: true });
            return;
        }
        await this.manager.notify(this);
        throw lastError;
    }
    async addAutoplay(seed) {
        if (!this.autoplay || this.autoplayFailures >= 3) return false;
        const seen = new Set(this.previousSongs.map(songIdentity));
        const artist = String(seed.artist || "").trim();
        const queries = [...new Set([`${artist} ${seed.name}`.trim(), artist || seed.name])];
        for (const query of queries) {
            if (this.manager.closing || this.manager.suspended.has(this.id)) return false;
            try {
                const result = await this.manager.resolve(query.slice(0, 1900));
                if (this.manager.closing || this.manager.suspended.has(this.id)) return false;
                const candidate = result.tracks.map(track => trackView(track, seed.user))
                    .find(song => !song.isLive && !seen.has(songIdentity(song)));
                if (!candidate) continue;
                candidate.autoplayGenerated = true;
                this.songs.push(candidate);
                this.manager.logger.info(`[QUEUE] Autoplay candidate selected (${this.id})`);
                return true;
            } catch (error) {
                this.manager.logger.warn(`[MUSIC] Autoplay search failed (${this.id})`, {
                    code: error.code || error.name,
                });
            }
        }
        this.manager.logger.warn(`[MUSIC] Autoplay found no unplayed candidate (${this.id})`);
        return false;
    }
    async advance(manual = false, failed = false) {
        const old = this.songs[0];
        if (!old) return;
        if (failed && old.autoplayGenerated) this.autoplayFailures++;
        else if (!failed) this.autoplayFailures = 0;
        if (!manual && !failed && this.repeatMode === 1) return this.start();
        this.songs.shift();
        this.remember(old);
        if (!manual && !failed && this.repeatMode === 2) this.songs.push(old);
        // Autoplay can choose another candidate after a failed start, with one
        // shared failure budget across REST rejections and exception/end events.
        for (let attempt = 0; attempt < 3; attempt++) {
            if (!this.songs.length && !await this.addAutoplay(old)) break;
            try {
                return await this.start();
            } catch (error) {
                if (this.songs.length) throw error; // Retain pending requests for Resume or /play.
            }
        }
        this.epoch++;
        this.playId = null;
        this.playbackFailed = false;
        await this.player.stopTrack();
        await this.manager.notify(this);
        if (this.manager.settings.music.leaveOnFinish && !this.manager.isPersistent(this.id))
            this.manager.scheduleIdle(
                this,
                () => !this.songs.length,
                this.manager.settings.music.leaveOnFinishCooldown,
            );
    }
    skip() {
        return this.run(() => this.advance(true));
    }
    previous() {
        return this.run(async () => {
            const song = this.previousSongs.pop();
            if (!song) throw new Error("Tidak ada lagu sebelumnya.");
            this.songs.unshift(song);
            await this.start();
        });
    }
    pause() {
        return this.run(async () => {
            await this.player.setPaused(true);
            await this.manager.notify(this);
        });
    }
    resume() {
        return this.run(async () => {
            if (this.playbackFailed) return this.start();
            await this.player.setPaused(false);
            await this.manager.notify(this);
        });
    }
    seek(seconds) {
        return this.run(async () => {
            if (
                !Number.isFinite(seconds) ||
                seconds < 0 ||
                this.songs[0]?.isLive ||
                seconds > (this.songs[0]?.duration || 0)
            )
                throw new Error("Posisi seek tidak valid.");
            await this.updatePlayer({ position: seconds * 1000 });
            await this.manager.notify(this);
        });
    }
    setVolume(volume) {
        return this.run(async () => {
            if (!Number.isInteger(volume) || volume < 0 || volume > 150)
                throw new Error("Volume harus 0–150%.");
            await this.updatePlayer({ volume });
            this.volume = volume;
            await this.manager.notify(this);
        });
    }
    setRepeatMode(mode) {
        return this.run(async () => {
            if (mode === undefined) mode = (this.repeatMode + 1) % 3;
            if (![0, 1, 2].includes(mode)) throw new Error("Invalid loop mode");
            this.repeatMode = mode;
            await this.manager.notify(this);
            return mode;
        });
    }
    adjustVolume(delta) {
        return this.run(async () => {
            if (!Number.isFinite(delta)) throw new Error("Volume tidak valid.");
            const volume = Math.max(0, Math.min(150, this.volume + delta));
            await this.updatePlayer({ volume });
            this.volume = volume;
            await this.manager.notify(this);
        });
    }
    toggleAutoplay() {
        return this.run(async () => {
            this.autoplay = !this.autoplay;
            if (this.autoplay) this.autoplayFailures = 0;
            await this.manager.notify(this);
            return this.autoplay;
        });
    }
    remove(index) {
        return this.run(async () => {
            if (!Number.isInteger(index) || index < 1 || index >= this.songs.length)
                throw new Error("Invalid queue position");
            const [song] = this.songs.splice(index, 1);
            await this.manager.notify(this);
            return song;
        });
    }
    move(from, to) {
        return this.run(async () => {
            if (
                ![from, to].every(
                    (index) => Number.isInteger(index) && index >= 1 && index < this.songs.length,
                )
            )
                throw new Error("Invalid queue position");
            const [song] = this.songs.splice(from, 1);
            this.songs.splice(to, 0, song);
            await this.manager.notify(this);
            return song;
        });
    }
    clear() {
        return this.run(async () => {
            const removed = this.songs.splice(1);
            await this.manager.notify(this);
            return removed;
        });
    }
    shuffle() {
        return this.run(async () => {
            for (let i = this.songs.length - 1; i > 1; i--) {
                const j = 1 + Math.floor(Math.random() * i);
                [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
            }
            await this.manager.notify(this);
        });
    }
    stop({ disconnect = this.manager.settings.music.leaveOnStop } = {}) {
        const member = this.manager.actors.getStore();
        if (member) this.manager.assertMember(member, this.voiceChannel);
        if (this.manager.getQueue(this.id) !== this)
            return Promise.reject(new Error("Player sudah tidak aktif."));
        this.manager.suspend(this.id);
        return this.manager.run(this.id, async () => {
            if (this.manager.getQueue(this.id) !== this) throw new Error("Player sudah tidak aktif.");
            this.songs = [];
            this.playbackFailed = false;
            this.playId = null;
            this.epoch++;
            try {
                await this.player.stopTrack();
            } catch (error) {
                await this.manager.disconnect(this.id);
                throw error;
            }
            this.recovering = false;
            await this.manager.notify(this);
            if (disconnect) await this.manager.disconnect(this.id);
        });
    }
}
module.exports = { MusicQueue, trackView, formatTime };
