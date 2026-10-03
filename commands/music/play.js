const { SlashCommandBuilder } = require("discord.js");
const { checkVoiceChannel } = require("../../utils/musicChecks.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");
module.exports = {
    data: new SlashCommandBuilder().setName("play").setDescription("Cari dan putar musik bersama melalui Lavalink")
        .addStringOption(option => option.setName("query").setDescription("Judul, artis, atau URL musik").setRequired(true).setMaxLength(2000)),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        if (!interaction.client.music) return interaction.reply({ content: "Fitur music belum tersedia.", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        try {
            logger.info(`[MUSIC] Search requested (${interaction.guildId})`);
            const result = await interaction.client.music.resolve(interaction.options.getString("query", true));
            logger.info(`[LAVALINK] Search successful (${interaction.guildId})`);
            const tracks = result.type === "search" ? result.tracks.slice(0, 1) : result.tracks;
            const denied = require("../../src/bot/middleware/accessPolicy").accessError(interaction.user.id, interaction.guildId);
            if (denied) return interaction.editReply({ content:denied, components:[] });
            const count = await interaction.client.music.enqueue(check.memberVoice, tracks, { textChannel: interaction.channel, member: interaction.member });
            return interaction.editReply({ content: "", embeds: [createSuccessEmbed(count === 1 ? tracks[0].info.title.slice(0, 250) : `${count} tracks added`, "Added to queue")], components: [] });
        } catch (error) {
            logger.warn(`[MUSIC] Play request failed (${interaction.guildId})`, {
                status: Number.isInteger(error.status) ? error.status : "unavailable",
                operation: error.operation || "voice-or-queue",
                code: error.code || error.name,
            });
            const message = error.code === "LAVALINK_TIMEOUT"
                ? "Node musik terlalu lama merespons. Coba lagi sebentar atau gunakan URL lagu langsung."
                : error.code === "LAVALINK_REQUEST_FAILED"
                  ? `Node musik gagal memproses ${error.operation === "search" ? "pencarian" : "pemutaran"} (HTTP ${error.status}). Coba lagu lain; jika tetap gagal, admin perlu memeriksa node musik.`
                  : "Lagu belum bisa diputar. Pastikan kamu masih di voice channel yang sama dan bot memiliki izin Connect/Speak.";
            return interaction.editReply({ content: "", embeds: [createErrorEmbed(message)], components: [] });
        }
    }
};
