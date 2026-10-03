const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("report")
        .setDescription("Laporkan user yang melanggar aturan")
        .addUserOption((o) => o.setName("user").setDescription("User yang dilaporkan").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan laporan").setRequired(true)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        await interaction.reply({ embeds: [createSuccessEmbed("Laporanmu telah dikirim ke moderator.")], ephemeral: true });

        await logger.sendLog(
            interaction.client,
            interaction.guild.id,
            createWarningEmbed(
                `**Dilaporkan oleh:** ${interaction.user.tag}\n**User dilaporkan:** ${target.tag}\n**Alasan:** ${reason}`,
                "🚩 Laporan Baru"
            )
        );
    }
};
