const logger = require("./logger.js");

const MAX_HISTORY = 50;
const MAX_PLAYLISTS = 10;
const MAX_PLAYLIST_SONGS = 50;
const sleepTimers = new Map();

function createMusicFeatures(db) {
    function normalizeName(name) {
        return String(name || "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function findPlaylistKey(playlists, name) {
        const normalized = normalizeName(name).toLowerCase();
        return Object.keys(playlists).find((key) => key.toLowerCase() === normalized) || null;
    }

    function getPlaylists(userId) {
        const user = db.getUser(userId);
        if (!user.playlists || typeof user.playlists !== "object" || Array.isArray(user.playlists)) {
            db.updateUser(userId, { playlists: {} });
            return {};
        }
        return user.playlists;
    }

    function createPlaylist(userId, name) {
        const playlistName = normalizeName(name);
        const playlists = getPlaylists(userId);
        if (["__proto__", "constructor", "prototype"].includes(playlistName))
            return { ok: false, reason: "Nama playlist tidak valid." };
        if (!playlistName) return { ok: false, reason: "Nama playlist tidak boleh kosong." };
        if (findPlaylistKey(playlists, playlistName))
            return { ok: false, reason: "Playlist dengan nama itu sudah ada." };
        if (Object.keys(playlists).length >= MAX_PLAYLISTS) {
            return { ok: false, reason: `Maksimal ${MAX_PLAYLISTS} playlist per user.` };
        }

        playlists[playlistName] = [];
        db.updateUser(userId, { playlists });
        return { ok: true, name: playlistName };
    }

    function deletePlaylist(userId, name) {
        const playlists = getPlaylists(userId);
        const key = findPlaylistKey(playlists, name);
        if (!key) return { ok: false, reason: "Playlist tidak ditemukan." };
        delete playlists[key];
        db.updateUser(userId, { playlists });
        return { ok: true, name: key };
    }

    function addSongToPlaylist(userId, name, song) {
        const playlists = getPlaylists(userId);
        const key = findPlaylistKey(playlists, name);
        if (!key) return { ok: false, reason: "Playlist tidak ditemukan." };
        if (!song?.url) return { ok: false, reason: "Lagu ini tidak memiliki URL yang bisa disimpan." };
        if (playlists[key].some((item) => item.url === song.url)) {
            return { ok: false, reason: "Lagu ini sudah ada di playlist tersebut." };
        }
        if (playlists[key].length >= MAX_PLAYLIST_SONGS) {
            return { ok: false, reason: `Satu playlist maksimal ${MAX_PLAYLIST_SONGS} lagu.` };
        }

        playlists[key].push({
            name: song.name,
            url: song.url,
            duration: song.formattedDuration || "??:??",
            thumbnail: song.thumbnail || "",
            addedAt: Date.now(),
        });
        db.updateUser(userId, { playlists });
        return { ok: true, name: key, count: playlists[key].length };
    }

    function removeSongFromPlaylist(userId, name, index) {
        const playlists = getPlaylists(userId);
        const key = findPlaylistKey(playlists, name);
        if (!key) return { ok: false, reason: "Playlist tidak ditemukan." };
        if (!Number.isInteger(index) || index < 1 || index > playlists[key].length) {
            return { ok: false, reason: `Nomor lagu harus antara 1 dan ${playlists[key].length}.` };
        }

        const [removed] = playlists[key].splice(index - 1, 1);
        db.updateUser(userId, { playlists });
        return { ok: true, name: key, song: removed };
    }

    function getPlaylist(userId, name) {
        const playlists = getPlaylists(userId);
        const key = findPlaylistKey(playlists, name);
        return key ? { name: key, songs: playlists[key] } : null;
    }

    function getHistory(guildId) {
        const history = db.getGuild(guildId).musicHistory;
        return Array.isArray(history) ? history : [];
    }

    function recordHistory(guildId, song) {
        if (!guildId || !song?.url) return;
        const history = getHistory(guildId).filter((item) => item.url !== song.url);
        history.unshift({
            name: song.name,
            url: song.url,
            duration: song.formattedDuration || "??:??",
            thumbnail: song.thumbnail || "",
            requester: song.user?.tag || song.user?.username || "",
            playedAt: Date.now(),
        });
        db.updateGuild(guildId, { musicHistory: history.slice(0, MAX_HISTORY) });
    }

    function setSleepTimer(guildId, minutes, onExpire) {
        clearSleepTimer(guildId);
        const durationMs = minutes * 60 * 1000;
        const timer = setTimeout(async () => {
            sleepTimers.delete(guildId);
            try {
                await onExpire();
            } catch (err) {
                logger.error(`[MUSIC] Sleep timer guild ${guildId} gagal: ${err.message}`);
            }
        }, durationMs);
        timer.unref?.();
        sleepTimers.set(guildId, { timer, endsAt: Date.now() + durationMs });
        return getSleepTimer(guildId);
    }

    function clearSleepTimer(guildId) {
        const current = sleepTimers.get(guildId);
        if (!current) return false;
        clearTimeout(current.timer);
        sleepTimers.delete(guildId);
        return true;
    }

    function getSleepTimer(guildId) {
        const current = sleepTimers.get(guildId);
        if (!current) return null;
        const remainingMs = Math.max(0, current.endsAt - Date.now());
        if (!remainingMs) {
            sleepTimers.delete(guildId);
            return null;
        }
        return { endsAt: current.endsAt, remainingMs };
    }

    function formatRemaining(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours) return `${hours}j ${minutes}m`;
        if (minutes) return `${minutes}m ${seconds}d`;
        return `${seconds}d`;
    }

    function setFavorite(userId, song, saved) {
        if (!song?.url) return { ok: false, reason: "Lagu ini tidak memiliki URL yang bisa disimpan." };
        const favorites = (db.getUser(userId).favoriteSongs || []).filter((item) => item.url !== song.url);
        if (saved)
            favorites.unshift({
                name: song.name,
                url: song.url,
                thumbnail: song.thumbnail || "",
                addedAt: Date.now(),
            });
        db.updateUser(userId, { favoriteSongs: favorites.slice(0, 50) });
        return { ok: true, saved };
    }
    return {
        setFavorite,
        MAX_HISTORY,
        MAX_PLAYLISTS,
        MAX_PLAYLIST_SONGS,
        createPlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        getPlaylist,
        getPlaylists,
        getHistory,
        recordHistory,
        setSleepTimer,
        clearSleepTimer,
        getSleepTimer,
        formatRemaining,
    };
}
module.exports = { ...createMusicFeatures(require("./database.js")), createMusicFeatures };
