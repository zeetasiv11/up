const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");
const {
    MAX_PLAYLIST_SONGS,
    addSongToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylist,
    getPlaylists,
    removeSongFromPlaylist
} = require("../../utils/musicFeatures.js");

const playlistNameOption = (option) =>
    option.setName("nama").setDescription("Nama playlist").setRequired(true).setMaxLength(40);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playlist")
        .setDescription("Simpan dan putar playlist musik pribadi")
        .addSubcommand((sub) => sub.setName("create").setDescription("Buat playlist baru").addStringOption(playlistNameOption))
        .addSubcommand((sub) => sub.setName("list").setDescription("Lihat semua playlist kamu"))
        .addSubcommand((sub) => sub.setName("add").setDescription("Simpan lagu yang sedang diputar").addStringOption(playlistNameOption))
        .addSubcommand((sub) =>
            sub
                .setName("view")
                .setDescription("Lihat isi playlist")
                .addStringOption(playlistNameOption)
        )
        .addSubcommand((sub) =>
            sub
                .setName("remove")
                .setDescription("Hapus lagu dari playlist")
                .addStringOption(playlistNameOption)
                .addIntegerOption((o) => o.setName("nomor").setDescription("Nomor lagu di playlist").setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) => sub.setName("delete").setDescription("Hapus playlist").addStringOption(playlistNameOption))
        .addSubcommand((sub) => sub.setName("play").setDescription("Putar semua lagu dalam playlist").addStringOption(playlistNameOption)),
    category: "music",
    async execute(interaction) {
        const action = interaction.options.getSubcommand();
        const name = interaction.options.getString("nama");
        const userId = interaction.user.id;

        if (action === "create") {
            const result = createPlaylist(userId, name);
            return interaction.reply({
                embeds: [result.ok ? createSuccessEmbed(`Playlist **${result.name}** berhasil dibuat.`, "📚 Playlist") : createErrorEmbed(result.reason)],
                ephemeral: true
            });
        }

        if (action === "list") {
            const playlists = getPlaylists(userId);
            const names = Object.entries(playlists).map(([playlistName, songs]) => `• **${playlistName}** — ${songs.length} lagu`);
            return interaction.reply({
                embeds: [createInfoEmbed(names.length ? names.join("\n") : "Kamu belum punya playlist.", "📚 Playlist Kamu")],
                ephemeral: true
            });
        }

        if (action === "delete") {
            const result = deletePlaylist(userId, name);
            return interaction.reply({
                embeds: [result.ok ? createSuccessEmbed(`Playlist **${result.name}** dihapus.`, "🗑️ Playlist") : createErrorEmbed(result.reason)],
                ephemeral: true
            });
        }

        if (action === "view") {
            const playlist = getPlaylist(userId, name);
            if (!playlist) return interaction.reply({ embeds: [createErrorEmbed("Playlist tidak ditemukan.")], ephemeral: true });
            const lines = playlist.songs.map((song, index) => `**${index + 1}.** [${song.name}](${song.url}) \`${song.duration}\``);
            return interaction.reply({
                embeds: [createInfoEmbed(lines.length ? lines.join("\n") : "Playlist ini masih kosong.", `📚 ${playlist.name} (${playlist.songs.length}/${MAX_PLAYLIST_SONGS})`)],
                ephemeral: true
            });
        }

        if (action === "add") {
            const check = checkVoiceChannel(interaction);
            if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
            const queue = await requireQueue(interaction);
            if (!queue) return;
            const result = addSongToPlaylist(userId, name, queue.songs[0]);
            return interaction.reply({
                embeds: [result.ok ? createSuccessEmbed(`Lagu disimpan ke **${result.name}** (${result.count} lagu).`, "➕ Playlist") : createErrorEmbed(result.reason)],
                ephemeral: true
            });
        }

        if (action === "remove") {
            const result = removeSongFromPlaylist(userId, name, interaction.options.getInteger("nomor", true));
            return interaction.reply({
                embeds: [result.ok ? createSuccessEmbed(`**${result.song.name}** dihapus dari **${result.name}**.`, "➖ Playlist") : createErrorEmbed(result.reason)],
                ephemeral: true
            });
        }

        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        const playlist = getPlaylist(userId, name);
        if (!playlist) return interaction.reply({ embeds: [createErrorEmbed("Playlist tidak ditemukan.")], ephemeral: true });
        if (!playlist.songs.length) return interaction.reply({ embeds: [createErrorEmbed("Playlist ini masih kosong.")], ephemeral: true });

        const distube = interaction.client.distube;
        if (!distube) return interaction.reply({ embeds: [createErrorEmbed("Fitur musik sedang tidak aktif.")], ephemeral: true });

        await interaction.deferReply();
        let added = 0;
        for (const song of playlist.songs) {
            try {
                await distube.play(interaction.member.voice.channel, song.url, {
                    textChannel: interaction.channel,
                    member: interaction.member
                });
                added++;
            } catch {
                // Satu lagu yang sudah tidak tersedia tidak boleh menggagalkan seluruh playlist.
            }
        }

        return interaction.editReply({
            embeds: [
                added
                    ? createSuccessEmbed(`**${added}/${playlist.songs.length}** lagu dari **${playlist.name}** masuk ke antrian.`, "▶️ Playlist Diputar")
                    : createErrorEmbed("Tidak ada lagu playlist yang berhasil diputar.")
            ]
        });
    }
};