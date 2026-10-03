const { isIP } = require("node:net");
function identifier(input) {
    const value = String(input || "").trim();
    if (!value || value.length > 2000) throw new Error("Query tidak valid.");
    if (/^(ytsearch|ytmsearch|scsearch):/.test(value)) return value;
    if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        const defaults = [
            "youtube.com",
            "youtu.be",
            "music.youtube.com",
            "open.spotify.com",
            "soundcloud.com",
            "on.soundcloud.com",
        ];
        const allowed = [
            ...defaults,
            ...(process.env.LAVALINK_ALLOWED_URL_HOSTS || "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
        ];
        if (
            url.username ||
            url.password ||
            isIP(url.hostname) ||
            !allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
        ) {
            throw new Error("Host URL belum diizinkan untuk audio. Gunakan source musik yang tersedia.");
        }
        return url.href;
    }
    if (/^[a-z]+:/i.test(value)) throw new Error("Source pencarian tidak didukung.");
    const source = process.env.LAVALINK_SEARCH_SOURCE || "ytsearch";
    if (!["ytsearch", "ytmsearch", "scsearch"].includes(source))
        throw new Error("Invalid LAVALINK_SEARCH_SOURCE");
    return `${source}:${value}`;
}
async function resolve(manager, input) {
    const query = identifier(input);
    const node = manager.getIdealNode();
    if (!node) throw new Error("Music node sedang tidak tersedia. Coba lagi sebentar.");
    const result = await node.rest.resolve(query);
    if (!result || ["empty", "error"].includes(result.loadType))
        throw new Error("Lagu tidak ditemukan atau source belum tersedia di node.");
    const resolved = {
        type: result.loadType,
        tracks:
            result.loadType === "track"
                ? [result.data]
                : result.loadType === "playlist"
                  ? result.data.tracks
                  : result.data,
        name: result.loadType === "playlist" ? result.data.info.name : null,
    };
    validateTracks(resolved.tracks);
    return resolved;
}
function validateTracks(tracks) {
    if (
        !Array.isArray(tracks) ||
        !tracks.length ||
        tracks.some(
            (track) =>
                !track ||
                typeof track.encoded !== "string" ||
                !track.encoded ||
                typeof track.info?.title !== "string" ||
                typeof track.info?.author !== "string" ||
                !Number.isFinite(track.info?.length) ||
                track.info.length < 0,
        )
    )
        throw new Error("Lagu tidak ditemukan atau data track tidak valid.");
}
module.exports = { identifier, resolve, validateTracks };
