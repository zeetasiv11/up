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
        this.volume = manager.settings.music.defaultVolume;
        this.filters = new AudioFilters(this);
        this.voice = { leave: () => manager.leave(this.id), channel: voiceChannel };
    }
    get paused() {
        return this.player.paused;
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
    async start() {
        if (!this.songs[0]) return this.manager.notify(this);
        this.manager.clearIdleTimer(this.id, "finish");
        this.epoch++;
        this.playId = randomUUID();
        this.loading = true;
        void this.manager.notify(this).catch(() => {});
        try {
            await this.player.playTrack({
                track: { encoded: this.songs[0].encoded, userData: { playId: this.playId } },
                position: 0,
                paused: false,
            });
        } catch (error) {
            this.songs = [];
            this.epoch++;
            await this.player.stopTrack().catch(() => {});
            await this.manager.notify(this);
            throw error;
        } finally {
            this.loading = false;
        }
        this.manager.logger.info(`[PLAYER] Playback started (${this.id})`);
        try {
            this.manager.history(this.id, this.songs[0]);
        } catch {
            this.manager.logger.warn(`[MUSIC] History unavailable (${this.id})`);
        }
        await this.manager.notify(this);
    }
    async advance(manual = false) {
        const old = this.songs[0];
        if (!old) return;
        if (!manual && this.repeatMode === 1) return this.start();
        this.songs.shift();
        this.previousSongs.push(old);
        this.previousSongs = this.previousSongs.slice(-50);
        if (!manual && this.repeatMode === 2) this.songs.push(old);
        if (!this.songs.length && this.autoplay) {
            try {
                const result = await this.manager.resolve(`${old.artist} ${old.name}`);
                const seen = new Set(this.previousSongs.map((song) => song.url));
                const next = result.tracks.find((track) => track.info.uri && !seen.has(track.info.uri));
                if (next) this.songs.push(trackView(next, old.user));
            } catch (error) {
                this.manager.logger.warn(`Autoplay unavailable: ${error.message}`);
            }
        }
        if (this.songs.length) return this.start();
        this.epoch++;
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
