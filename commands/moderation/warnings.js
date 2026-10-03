const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Lihat daftar warning seorang member")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat warning-nya").setRequired(true)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const warnings = db.getWarnings(interaction.guild.id, target.id);

        if (warnings.length === 0) {
            return interaction.reply({ embeds: [createInfoEmbed(`${target.tag} belum pernah mendapat warning.`)] });
        }

        const list = warnings
            .map((w, i) => `**#${i + 1}** — ${w.reason}\n*oleh ${w.moderator} • <t:${Math.floor(w.timestamp / 1000)}:R>*`)
            .join("\n\n");

        await interaction.reply({ embeds: [createInfoEmbed(list, `⚠️ Warnings untuk ${target.tag} (${warnings.length})`)] });
    }
};
