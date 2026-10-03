const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, escapeMarkdown } = require("discord.js");
const { MusicEmojiManager } = require("../src/music/MusicEmojiManager.js");
const theme = require("../src/music/MusicTheme.js");
const { progressBar } = require("./musicFormat.js");
const safeUrl = value => { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } };
const text = (value, max = 256) => escapeMarkdown(String(value || "Unknown track").slice(0, max));
const emojiFor = queue => new MusicEmojiManager({ guild: queue?.textChannel?.guild, channel: queue?.textChannel, overrides: queue?.manager?.repository.getDB?.().stats?.musicEmojis || {} });
function buildNowPlayingEmbed(queue, song) {
    const emoji = emojiFor(queue);
    const artist = song.uploader?.name || song.artist || "";
    const unavailable = queue.player?.node && queue.player.node.state !== require("shoukaku").Constants.State.CONNECTED;
    const status = queue.loading ? `${emoji.getLoadingEmoji()} LOADING` : unavailable ? `${emoji.getLoadingEmoji()} RECONNECTING` : queue.paused ? `${emoji.getPauseEmoji()} PAUSED` : `${emoji.getPlayingEmoji()} PLAYING`;
    const embed = new EmbedBuilder().setColor(queue.paused ? theme.muted : theme.accent)
        .setAuthor({ name: theme.brand }).setTitle(String(song.name || "Unknown track").slice(0, 256))
        .setDescription(`${status}\n${artist ? `**${text(artist, 180)}**\n\n` : "\n"}` +
            `${queue.formattedCurrentTime || "00:00"}  ${progressBar(queue.currentTime || 0, song.duration)}  ${song.formattedDuration || "LIVE"}\n\n` +
            `${emoji.getVolumeEmoji()} ${queue.volume}%   ·   ${Math.max(0, (queue.songs?.length || 1) - 1)} queued   ·   Loop ${theme.loops[queue.repeatMode] || "Off"}`)
        .setFooter({ text: `Requested by ${String(song.user?.displayName || song.user?.username || "a listener").slice(0, 80)} · Autoplay ${queue.autoplay ? "on" : "off"}` });
    const url = safeUrl(song.url), image = safeUrl(song.thumbnail);
    if (url) embed.setURL(url);
    if (image) embed.setImage(image);

    return embed;
}
function buildIdleMusicEmbed(reason = "Your next listening session starts here.") {
    return new EmbedBuilder().setColor(theme.muted).setAuthor({ name: theme.brand })
        .setTitle("Nothing is playing")
        .setDescription(`${reason}\n\nUse **/play** with a song, artist, or link.`)
        .setFooter({ text: "One server. One shared listening space." });
}
function buildControlRows(queue) {
    const active = Boolean(queue?.songs?.length), emoji = emojiFor(queue);
    const button = (id, label, icon, style = ButtonStyle.Secondary, disabled = !active) => new ButtonBuilder()
        .setCustomId(`music_${id}`).setLabel(label).setEmoji(emoji.get(icon)).setStyle(style).setDisabled(disabled);
    const primary = new ActionRowBuilder().addComponents(
        button("prev", "Previous", "previous", ButtonStyle.Secondary, !active || !queue?.previousSongs?.length),
        button("playpause", queue?.paused ? "Resume" : "Pause", queue?.paused ? "play" : "pause", ButtonStyle.Primary),
        button("skip", "Next", "next", ButtonStyle.Secondary, !active || (queue.songs.length < 2 && !queue.autoplay))
    );
    const secondary = new ActionRowBuilder().addComponents(
        button("queue", "Queue", "queue"), button("fav", "Favorite", "heart"), button("shuffle", "Shuffle", "shuffle"),
        button("loop", `Loop: ${theme.loops[queue?.repeatMode] || "Off"}`, "loop", queue?.repeatMode ? ButtonStyle.Success : ButtonStyle.Secondary),
        button("volume", `${queue?.volume ?? 100}%`, "volume")
    );
    const more = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("music_more_menu")
        .setPlaceholder(`More controls · Autoplay ${queue?.autoplay ? "on" : "off"}`).setDisabled(!active).addOptions(
            ...[ { label: "Lyrics", value: "lyrics" }, { label: "My favorites", value: "favorites" },
            { label: "Replay", value: "action:replay" }, { label: "Toggle autoplay", value: "action:autoplay" },
            { label: "Stop playback", value: "action:stop" }, { label: "Disconnect", value: "action:disconnect" },
            { label: "Audio: Normal", value: "effect_off" }, { label: "Audio: Bassboost", value: "effect_bassboost" },
            { label: "Audio: Nightcore", value: "effect_nightcore" }, { label: "Audio: Vaporwave", value: "effect_vaporwave" },
            { label: "Audio: 8D", value: "effect_8d" }, { label: "Audio: Karaoke", value: "effect_karaoke" },
            { label: "Audio: Pop", value: "effect_pop" }, { label: "Audio: Soft", value: "effect_soft" },
            { label: "Audio: Treble", value: "effect_treble" }, { label: "Audio: Tremolo", value: "effect_tremolo" }, { label: "Audio: Vibrato", value: "effect_vibrato" }
            ].filter(option => !option.value.startsWith("effect_") || option.value === "effect_off" || !queue?.filters?.supports || queue.filters.supports(option.value.slice(7)))
        ));
    return [primary, secondary, more];
}
module.exports = { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows, safeUrl };
