const { createHash } = require("node:crypto");
const { z } = require("zod");
const { HttpError } = require("./auth");
const { createMusicFeatures } = require("../../utils/musicFeatures");

const inputSchema = z
    .object({
        version: z.string().length(64),
        action: z.enum(["create", "delete", "addCurrent", "remove"]),
        name: z.string().trim().min(1).max(40).optional(),
        url: z.string().max(2000).optional(),
    })
    .strict();

function createMusicLibrary(db) {
    const features = createMusicFeatures(db);
    function read(userId, section) {
        const user = db.getUser(userId);
        const items = section === "favorites" ? user.favoriteSongs || [] : user.playlists || {};
        return {
            version: createHash("sha256").update(JSON.stringify(items)).digest("hex"),
            items: structuredClone(items),
        };
    }
    async function update(userId, section, body, currentTrack) {
        const input = inputSchema.parse(body);
        const snapshot = read(userId, section);
        if (input.version !== snapshot.version)
            throw new HttpError(409, "Your library changed. Refresh this page and try again.");
        let result;
        // No await between reading the version and changing the shared cache.
        if (section === "favorites") {
            if (input.action === "addCurrent") result = features.setFavorite(userId, currentTrack, true);
            else if (input.action === "remove" && input.url) {
                const song = snapshot.items.find((item) => item.url === input.url);
                if (!song) throw new HttpError(404, "Favorite not found.");
                result = features.setFavorite(userId, song, false);
            }
        } else if (input.name) {
            if (input.action === "create") result = features.createPlaylist(userId, input.name);
            if (input.action === "delete") result = features.deletePlaylist(userId, input.name);
            if (input.action === "addCurrent")
                result = features.addSongToPlaylist(userId, input.name, currentTrack);
            if (input.action === "remove" && input.url) {
                const playlist = features.getPlaylist(userId, input.name);
                const index = playlist?.songs.findIndex((song) => song.url === input.url) ?? -1;
                if (index < 0) throw new HttpError(404, "Track not found in this playlist.");
                result = features.removeSongFromPlaylist(userId, input.name, index + 1);
            }
        }
        if (!result?.ok) throw new HttpError(400, result?.reason || "Invalid library action.");
        await db.flush();
        return read(userId, section);
    }
    return { read, update };
}
module.exports = { createMusicLibrary };
