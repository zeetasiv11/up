const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Hentikan musik, hapus antrian, dan keluar dari voice channel"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = check.queue;
        if (!queue) return interaction.reply({ embeds: [createErrorEmbed("Tidak ada player aktif.")], ephemeral: true });

        try {
            await queue.stop();
            await interaction.reply({ embeds: [createSuccessEmbed("Musik dihentikan dan antrian dihapus.", "⏹️ Stop")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal menghentikan musik: \`${err.message}\``)], ephemeral: true });
        }
    }
};