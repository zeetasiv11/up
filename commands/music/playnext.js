const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const { createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");
const { normalizeMusicQuery } = require("../../utils/musicQuery.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playnext")
        .setDescription("Tambahkan lagu supaya diputar tepat setelah lagu yang sekarang, bukan di akhir antrian")
        .addStringOption((o) =>
            o
                .setName("query")
                .setDescription("Judul lagu, nama artis, atau link YouTube/Spotify/SoundCloud")
                .setRequired(true)
        ),
    category: "music",
    async execute(interaction) {
        const query = interaction.options.getString("query", true).trim();
        const playerQuery = normalizeMusicQuery(query);
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                embeds: [createErrorEmbed("Kamu harus join voice channel terlebih dahulu untuk memutar musik!")],
                ephemeral: true
            });
        }

        const botMember = interaction.guild.members.me;
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has(["Connect", "Speak"])) {
            return interaction.reply({
                embeds: [createErrorEmbed("Bot tidak memiliki izin **Connect** dan **Speak** di voice channel tersebut!")],
                ephemeral: true
            });
        }

        const distube = interaction.client.distube;
        if (!distube) {
            return interaction.reply({
                embeds: [createErrorEmbed("Fitur music sedang tidak aktif di bot ini.")],
                ephemeral: true
            });
        }

        const existingQueue = distube.getQueue(interaction.guildId);
        if (!existingQueue) {
            return interaction.reply({
                embeds: [createErrorEmbed("Tidak ada lagu yang sedang diputar. Pakai `/play` dulu untuk mulai antrian.")],
                ephemeral: true
            });
        }

        if (existingQueue.songs.length >= settings.music.maxQueueSize) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Antrian sudah penuh (maksimal **${settings.music.maxQueueSize}** lagu).`)],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // position: 1 = taruh tepat setelah lagu yang sedang diputar (posisi 0),
            // bukan ditambahkan ke ujung antrian seperti /play biasa.
            await distube.play(voiceChannel, playerQuery, {
                textChannel: interaction.channel,
                member: interaction.member,
                position: 1
            });

            await interaction.editReply({
                embeds: [createInfoEmbed(`Mencari dan menaruh **${query}** tepat setelah lagu ini...`, "⏭️ Memproses")]
            });
        } catch (err) {
            await interaction.editReply({
                embeds: [createErrorEmbed(`Gagal menambahkan lagu: \`${err.message || err}\``)]
            });
        }
    }
};
