const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
/**
 * ============================================
 *  MUSIC BUTTONS & MORE-FEATURES MENU (v3)
 * ============================================
 */
const settings = require("../settings.js");
const db = require("./database.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("./embeds.js");
const { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows } = require("./musicPanel.js");

const MAX_QUEUE_SHOWN = 15;


function getQueueOrReplyError(interaction) {
    const queue = interaction.client.distube?.getQueue(interaction.guildId);
    if (!queue || !queue.songs?.length) {
        interaction.reply({ embeds: [createErrorEmbed("Tidak ada musik yang sedang diputar di server ini.")], ephemeral: true }).catch(() => {});
        return null;
    }
    return queue;
}

/** Member harus di voice channel yang sama dengan bot untuk aksi yang mengubah playback. */
function memberInSameVoice(interaction, queue) {
    if (!interaction.guildId || queue.id !== interaction.guildId)
        return { ok: false, reason: "Panel tidak berada di server player ini." };
    const botVoice = interaction.guild?.members?.me?.voice;
    if (botVoice && botVoice.channelId !== queue.voiceChannel.id && !(queue.recovering && !botVoice.channelId))
        return { ok: false, reason: "Koneksi voice bot berubah. Gunakan /play lagi." };
    const djRole = settings.music.djRoleId;
    if (djRole && !interaction.member?.roles?.cache?.has(djRole) && !interaction.member?.permissions?.has("ManageGuild")) return { ok: false, reason: "Role DJ diperlukan." };
    const memberVoice = interaction.member?.voice?.channel;
    if (!memberVoice) return { ok: false, reason: "Kamu harus join voice channel terlebih dahulu!" };
    if (queue.voiceChannel && queue.voiceChannel.id !== memberVoice.id) {
        return { ok: false, reason: `Kamu harus berada di voice channel yang sama dengan bot: <#${queue.voiceChannel.id}>` };
    }
    if (memberVoice.permissionsFor && !memberVoice.permissionsFor(interaction.guild?.members?.me)?.has(["Connect", "Speak"]))
        return { ok: false, reason: "Bot membutuhkan izin Connect dan Speak." };
    return { ok: true };
}

/** Setelah aksi berhasil mengubah state, update ulang panel Now Playing di tempat (edit pesan yang sama). */
async function refreshPanel(interaction, queue) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    await interaction.client.music?.notify(queue);
}
async function respond(interaction, payload) {
    return interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
}

async function handleMusicButton(interaction, id = interaction.customId) {
    const queue = getQueueOrReplyError(interaction);
    if (!queue) return;

    const check = memberInSameVoice(interaction, queue);
    if (!check.ok) {
        return respond(interaction, { embeds: [createErrorEmbed(check.reason)], ephemeral: true }).catch(() => {});
    }
    if (id === "music_queue") return sendQueueList(interaction, queue);
    if (/^music_queue_page:\d+$/.test(id)) return sendQueueList(interaction, queue, Number(id.split(":")[1]), true);
    if (id === "music_fav") return toggleFavorite(interaction, queue);

    if (id === "music_volume") {
        return interaction.showModal(new ModalBuilder().setCustomId("music_volume_submit").setTitle("Player volume")
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("volume")
                .setLabel("Volume · 0–150%").setStyle(TextInputStyle.Short).setValue(String(queue.volume)).setRequired(true).setMaxLength(3))));
    }

    try {
        await interaction.deferUpdate();
        if (["music_effect_bassboost", "music_effect_8d"].includes(id)) {
            const effect = id.slice("music_effect_".length);
            if (queue.filters.has(effect)) await queue.filters.remove(effect);
            else await queue.filters.add(effect);
            return refreshPanel(interaction, queue);
        }
        if (id === "music_prev") {
            if (!queue.previousSongs?.length) {
                return respond(interaction, { embeds: [createErrorEmbed("Tidak ada lagu sebelumnya.")], ephemeral: true });
            }
            await queue.previous();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_playpause") {
            if (queue.paused) await queue.resume();
            else await queue.pause();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_skip") {
            if (queue.songs.length <= 1 && !queue.autoplay) {
                return respond(interaction, { embeds: [createErrorEmbed("Tidak ada lagu selanjutnya di antrian.")], ephemeral: true });
            }
            await queue.skip();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_shuffle") {
            if (queue.songs.length <= 2) {
                return respond(interaction, { embeds: [createErrorEmbed("Antrian terlalu pendek untuk diacak.")], ephemeral: true });
            }
            await queue.shuffle();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_loop") {
            await queue.setRepeatMode();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_volup") {
            await queue.adjustVolume(10);
            return refreshPanel(interaction, queue);
        }

        if (id === "music_voldown") {
            await queue.adjustVolume(-10);
            return refreshPanel(interaction, queue);
        }

        if (id === "music_autoplay") {
            await queue.toggleAutoplay();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_replay") {
            const song = queue.songs[0];
            if (song?.isLive) {
                return respond(interaction, { embeds: [createErrorEmbed("Tidak bisa mengulang siaran live.")], ephemeral: true });
            }
            await queue.seek(0);
            return refreshPanel(interaction, queue);
        }

        if (id === "music_bassboost") {
            if (queue.filters.has("bassboost")) {
                await queue.filters.remove("bassboost");
            } else {
                await queue.filters.add("bassboost");
            }
            return refreshPanel(interaction, queue);
        }

        if (id === "music_disconnect") {
            await queue.stop({ disconnect: true });
            return refreshPanel(interaction, queue);
        }

        if (id === "music_stop") {
            await queue.stop();

            return refreshPanel(interaction, queue);
        }
    } catch (err) {
        return respond(interaction, { embeds: [createErrorEmbed("Kontrol belum berhasil. Coba lagi setelah node tersambung.")], ephemeral: true }).catch(() => {});
    }
}

async function sendQueueList(interaction, queue, requestedPage = 0, update = false) {
    const upcoming = queue.songs.slice(1), size = 4;
    const pages = Math.max(1, Math.ceil(upcoming.length / size));
    const page = Math.max(0, Math.min(pages - 1, Number.isSafeInteger(requestedPage) ? requestedPage : 0));
    const { safeUrl } = require("./musicPanel.js");
    const theme = require("../src/music/MusicTheme.js");
    const current = queue.songs[0];
    const header = new EmbedBuilder().setColor(theme.accent).setTitle("Your listening queue")
        .setDescription(`**Now** · ${String(current?.name || "Nothing playing").slice(0, 200)}\n${upcoming.length} tracks up next`)
        .setFooter({ text: `Page ${page + 1} of ${pages}` });
    const tracks = upcoming.slice(page * size, (page + 1) * size).map((song, index) => {
        const embed = new EmbedBuilder().setColor(theme.muted).setTitle(`${page * size + index + 1}. ${song.name}`.slice(0, 256))
            .setDescription(`${song.uploader?.name || song.artist || "Audio"} · ${song.formattedDuration || "LIVE"}`.slice(0, 1000));
        if (safeUrl(song.url)) embed.setURL(safeUrl(song.url));
        if (safeUrl(song.thumbnail)) embed.setThumbnail(safeUrl(song.thumbnail));
        return embed;
    });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`music_queue_page:${Math.max(0, page - 1)}`).setLabel("Previous page").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`music_queue_page:${page + 1}`).setLabel("Next page").setStyle(ButtonStyle.Secondary).setDisabled(page + 1 === pages)
    );
    const payload = { embeds: [header, ...tracks], components: [row], allowedMentions: { parse: [] } };
    return update ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function handleMusicModal(interaction) {
    const queue = getQueueOrReplyError(interaction);
    if (!queue) return;
    const check = memberInSameVoice(interaction, queue);
    if (!check.ok) return interaction.reply({ content: check.reason, ephemeral: true });
    const input = interaction.fields.getTextInputValue("volume").trim();
    if (!/^\d{1,3}$/.test(input) || Number(input) > 150) return interaction.reply({ content: "Volume harus 0–150%.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    await queue.setVolume(Number(input));
    await interaction.client.distube?.updateMusicPanel?.(queue, queue.songs[0]);
    return interaction.editReply({ content: `Volume ${input}%.` });
}

async function toggleFavorite(interaction, queue) {
    const song = queue.songs[0];
    if (!song) return;

    const saved = !(db.getUser(interaction.user.id).favoriteSongs || []).some(item => item.url === song.url);
    const result = require("./musicFeatures").setFavorite(interaction.user.id, song, saved);
    return interaction.reply({
        embeds: [result.ok ? createSuccessEmbed(`**${song.name}** ${saved ? "disimpan ke" : "dihapus dari"} favorit kamu.`) : createErrorEmbed(result.reason)],
        ephemeral: true
    });
}

// ---------------- MORE FEATURES SELECT MENU ----------------

async function handleMusicMoreMenu(interaction) {
    const value = interaction.values[0];
    const queue = getQueueOrReplyError(interaction);
    if (!queue) return;

    const check = memberInSameVoice(interaction, queue);
    if (!check.ok) return interaction.reply({ content: check.reason, ephemeral: true });
    if (value.startsWith("action:")) return handleMusicButton(interaction, `music_${value.slice(7)}`);
    if (value === "favorites") return sendFavoritesList(interaction);
    if (value === "lyrics") return sendLyrics(interaction, queue);

    if (value.startsWith("effect_")) {
        const check = memberInSameVoice(interaction, queue);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true }).catch(() => {});
        }

        const effect = value.slice("effect_".length);
        try {
            await interaction.deferUpdate();
            if (effect === "off") {
                await queue.filters.clear();
            } else {
                await queue.filters.set(effect);
            }
            return refreshPanel(interaction, queue);
        } catch (err) {
            return respond(interaction, {
                embeds: [createErrorEmbed("Efek belum dapat diterapkan. Periksa dukungan node.")],
                ephemeral: true
            }).catch(() => {});
        }
    }
}

/** Untuk aksi read-only (favorit, lirik) yang balasnya ephemeral & tidak mengubah playback. */

async function sendFavoritesList(interaction) {
    const user = db.getUser(interaction.user.id);
    const favorites = user.favoriteSongs || [];

    if (!favorites.length) {
        return interaction.reply({
            embeds: [createInfoEmbed("Kamu belum punya lagu favorit. Klik tombol ❤️ di panel musik untuk menambahkan.", "⭐ Favorit Kamu")],
            ephemeral: true
        });
    }

    const lines = favorites.slice(0, 20).map((f, i) => `**${i + 1}.** [${f.name}](${f.url})`);
    await interaction.reply({
        embeds: [createInfoEmbed(lines.join("\n"), `⭐ Favorit Kamu (${favorites.length} lagu)`)],
        ephemeral: true
    });
}

/**
 * Coba ambil lirik dari lyrics.ovh (API gratis, tanpa API key).
 * Best-effort: nama lagu di-parse kasar jadi "artis - judul", banyak nama lagu
 * YouTube yang berantakan jadi kadang tidak ketemu -> kasih pesan yang jelas.
 */
async function sendLyrics(interaction, queue) {
    const song = queue.songs[0];
    if (!song) return;

    await interaction.deferReply({ ephemeral: true });

    let artist = song.artist || "";
    let title = song.name;
    const separators = [" - ", " – ", " | "];
    for (const sep of separators) {
        if (song.name.includes(sep)) {
            const parts = song.name.split(sep);
            artist = parts[0].trim();
            title = parts.slice(1).join(sep).trim();
            break;
        }
    }

    // Bersihkan embel-embel umum judul YouTube yang bikin pencarian lirik gagal.
    title = title.replace(/\(.*?(official|lyrics|video|audio|mv|hd).*?\)/gi, "").replace(/\[.*?\]/g, "").trim();

    try {
        const query = artist ? `${encodeURIComponent(artist)}/${encodeURIComponent(title)}` : `unknown/${encodeURIComponent(title)}`;
        const res = await fetch(`https://api.lyrics.ovh/v1/${query}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();

        if (!data.lyrics) {
            return interaction.editReply({
                embeds: [createErrorEmbed("Lirik tidak ditemukan untuk lagu ini.", "📝 Lirik")]
            });
        }

        const pages = String(data.lyrics).slice(0,60000).match(/[\s\S]{1,3500}/g) || ["Lyrics unavailable."];
        let page = 0;
        const payload = () => ({ embeds:[createInfoEmbed(pages[page], `Lyrics · ${song.name}`.slice(0,256)).setFooter({text:`Page ${page+1} / ${pages.length}`})],
            components: pages.length > 1 ? [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`lyrics_prev:${interaction.id}`).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page===0),
                new ButtonBuilder().setCustomId(`lyrics_next:${interaction.id}`).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page===pages.length-1))] : [] });
        const message = await interaction.editReply(payload());
        if (pages.length > 1) {
            const collector = message.createMessageComponentCollector({time:120000,filter:click=>click.user.id===interaction.user.id && click.customId.endsWith(`:${interaction.id}`)});
            collector.on("collect", click => {
                page = Math.max(0,Math.min(pages.length-1,page+(click.customId.startsWith("lyrics_next")?1:-1)));
                click.update(payload()).catch(()=>{});
            });
            collector.on("end",()=>interaction.editReply({components:[]}).catch(()=>{}));
        }

    } catch (err) {
        await interaction.editReply({
            embeds: [createErrorEmbed("Lirik tidak ditemukan / gagal diambil untuk lagu ini. Judul dari YouTube kadang tidak cocok dengan database lirik.", "📝 Lirik")]
        });
    }
}

module.exports = { handleMusicButton, handleMusicMoreMenu, handleMusicModal, sendQueueList };
