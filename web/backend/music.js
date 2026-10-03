const { z } = require("zod");
const { HttpError } = require("./auth");
const { randomUUID } = require("node:crypto");
const actions = z
    .object({
        action: z.enum([
            "pause",
            "resume",
            "skip",
            "previous",
            "stop",
            "shuffle",
            "loop",
            "autoplay",
            "volume",
            "seek",
            "filter",
            "remove",
            "clear",
        ]),
        value: z.union([z.string().max(50), z.number().finite()]).optional(),
    })
    .strict();
const view = (song) =>
    song
        ? {
              title: song.name,
              artist: song.artist || song.uploader?.name || "",
              artwork: /^https:\/\//.test(song.thumbnail) ? song.thumbnail : "",
              duration: song.duration,
              live: song.isLive,
              source: song.source,
              requester: song.user?.username || "",
          }
        : null;
function playerState(client, guildId) {
    const queue = client?.music?.getQueue(guildId);
    return {
        available: Boolean(client?.music?.lavalink.getIdealNode()),
        status: !queue?.songs.length
            ? "idle"
            : queue.loading
              ? "loading"
              : queue.paused
                ? "paused"
                : "playing",
        track: view(queue?.songs[0]),
        queue: (queue?.songs.slice(1) || []).map(view),
        position: queue?.currentTime || 0,
        volume: queue?.volume || 0,
        loop: queue?.repeatMode || 0,
        autoplay: queue?.autoplay || false,
        filters: queue ? [...queue.filters.active.keys()] : [],
        supportedFilters: queue
            ? Object.keys(require("../../src/music/AudioFilters").PRESETS).filter((name) =>
                  queue.filters.supports(name),
              )
            : [],
        voiceChannel: queue?.voiceChannel.id || null,
    };
}
async function musicMember(client, guild, userId) {
    const denied = require("../../src/bot/middleware/accessPolicy").accessError(userId, guild.id);
    if (denied) throw new HttpError(403, denied);
    if (!client.music) throw new HttpError(503, "Music is unavailable.");
    const queue = client.music.getQueue(guild.id);
    const member = await guild.members.fetch(userId);
    if (!member.voice.channelId) throw new HttpError(403, "Join a voice channel in Discord first.");
    if (queue && member.voice.channelId !== queue.voiceChannel.id)
        throw new HttpError(403, "Join the player’s voice channel to control music.");
    const djRole = client.music.settings.music.djRoleId;
    if (djRole && !member.roles.cache.has(djRole) && !member.permissions.has("ManageGuild"))
        throw new HttpError(403, "DJ role is required.");
    return member;
}
async function control(client, guild, userId, body) {
    const { action, value } = actions.parse(body);
    const member = await musicMember(client, guild, userId);
    const queue = client.music.getQueue(guild.id);
    if (!queue?.songs.length) throw new HttpError(409, "Nothing is playing. Add a track first.");
    if (member.voice.channelId !== queue.voiceChannel.id)
        throw new HttpError(403, "Join the player’s voice channel to control music.");
    if (["pause", "resume", "skip", "previous", "stop", "shuffle", "toggleAutoplay"].includes(action))
        await queue[action]();
    else if (action === "autoplay") queue.toggleAutoplay();
    else if (action === "loop") queue.setRepeatMode((queue.repeatMode + 1) % 3);
    else if (action === "volume") await queue.setVolume(z.number().int().min(0).max(150).parse(value));
    else if (action === "seek") await queue.seek(z.number().min(0).parse(value));
    else if (action === "filter")
        await (value === "normal" ? queue.filters.clear() : queue.filters.set(z.string().parse(value)));
    else if (action === "clear") await queue.clear();
    else if (action === "remove") await queue.remove(z.number().int().min(1).parse(value));
    return playerState(client, guild.id);
}
function createMusicSearch({ now = Date.now } = {}) {
    const results = new Map();
    const pending = new Set();
    async function search(client, guild, userId, body) {
        const { query } = z
            .object({ query: z.string().trim().min(1).max(2000) })
            .strict()
            .parse(body);
        await musicMember(client, guild, userId);
        for (const [key, entry] of results) if (entry.expires <= now()) results.delete(key);
        if (pending.has(userId) || pending.size >= 50)
            throw new HttpError(429, "A search is already running. Try again shortly.");
        pending.add(userId);
        try {
            const resolved = await client.music.resolve(query);
            const tracks = resolved.type === "search" ? resolved.tracks.slice(0, 5) : resolved.tracks;
            if (!tracks.length) throw new HttpError(404, "No tracks found.");
            if (tracks.length > client.music.settings.music.maxQueueSize)
                throw new HttpError(400, "This playlist exceeds the server queue limit.");
            // One expiring result set per user/guild. The browser never supplies encoded tracks.
            for (const [key, entry] of results)
                if (entry.userId === userId && entry.guildId === guild.id) results.delete(key);
            while (results.size >= 200) results.delete(results.keys().next().value);
            const token = randomUUID();
            results.set(token, {
                userId,
                guildId: guild.id,
                tracks,
                type: resolved.type,
                expires: now() + 120000,
            });
            const options =
                resolved.type === "playlist"
                    ? [
                          {
                              index: 0,
                              title: resolved.name || "Playlist",
                              artist: `${tracks.length} tracks`,
                              count: tracks.length,
                              artwork: tracks[0].info.artworkUrl || "",
                          },
                      ]
                    : tracks.map((track, index) => ({
                          index,
                          title: track.info.title,
                          artist: track.info.author,
                          duration: track.info.length / 1000,
                          artwork: track.info.artworkUrl || "",
                          count: 1,
                      }));
            return { token, options, expiresIn: 120 };
        } catch (error) {
            if (error.status) throw error;
            require("../../utils/logger").warn("Web music search failed", {
                service: "music",
                error: error.message,
            });
            throw new HttpError(
                502,
                "Search is unavailable for this source. Check the URL or try again shortly.",
            );
        } finally {
            pending.delete(userId);
        }
    }
    async function enqueue(client, guild, userId, body) {
        const input = z
            .object({
                token: z.string().uuid(),
                index: z.number().int().min(0).max(4),
                channelId: z
                    .string()
                    .regex(/^\d{17,20}$/)
                    .optional(),
            })
            .strict()
            .parse(body);
        const entry = results.get(input.token);
        if (!entry || entry.expires <= now() || entry.userId !== userId || entry.guildId !== guild.id)
            throw new HttpError(409, "Search expired. Search again to add this track.");
        const member = await musicMember(client, guild, userId);
        const queue = client.music.getQueue(guild.id);
        const channelId = queue?.textChannel?.id || input.channelId;
        const channel = channelId ? await guild.channels.fetch(channelId) : null;
        if (
            !channel ||
            channel.guildId !== guild.id ||
            ![0, 5].includes(channel.type) ||
            !channel.permissionsFor(member)?.has("ViewChannel") ||
            !channel
                .permissionsFor(guild.members.me)
                ?.has(["ViewChannel", "SendMessages", "EmbedLinks", "AttachFiles"])
        )
            throw new HttpError(
                400,
                "Choose a text channel you can view where the bot can send embeds and files.",
            );
        const tracks =
            entry.type === "playlist" && input.index === 0 ? entry.tracks : [entry.tracks[input.index]];
        if (!tracks[0] || (entry.type === "playlist" && input.index !== 0))
            throw new HttpError(400, "Invalid track selection.");
        // Consume immediately before playback; two concurrent clicks cannot enqueue twice.
        if (results.get(input.token) !== entry || entry.expires <= now())
            throw new HttpError(409, "This search was already used or expired. Search again.");
        results.delete(input.token);
        try {
            const count = await client.music.enqueue(member.voice.channel, tracks, {
                member,
                textChannel: channel,
            });
            return { count, state: playerState(client, guild.id) };
        } catch (error) {
            require("../../utils/logger").warn("Web music enqueue failed", {
                service: "music",
                error: error.message,
            });
            throw new HttpError(
                409,
                "Could not add tracks. Check your voice channel, queue limit and music node, then search again.",
            );
        }
    }
    return { search, enqueue };
}
module.exports = { playerState, control, musicMember, createMusicSearch };
