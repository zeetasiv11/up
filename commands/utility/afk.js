const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("afk")
        .setDescription("Atur status AFK kamu")
        .addStringOption((o) => o.setName("reason").setDescription("Alasan AFK")),
    async execute(interaction) {
        const reason = interaction.options.getString("reason") || "Tidak ada alasan";
        const database = db.getDB();
        database.afk[interaction.user.id] = { reason, timestamp: Date.now() };
        db.save();

        await interaction.reply({ embeds: [createSuccessEmbed(`Status AFK diatur: **${reason}**`, "💤 AFK")] });
    }
};
