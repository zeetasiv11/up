const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("stats").setDescription("Lihat statistik penggunaan bot"),
    async execute(interaction) {
        const client = interaction.client;
        const database = db.getDB();
        const totalUsers = Object.keys(database.users).length;

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Total Server:** ${client.guilds.cache.size}\n` +
                        `**Total Command Digunakan:** ${database.stats.commandsUsed || 0}\n` +
                        `**Total User Terdaftar di Database:** ${totalUsers}\n` +
                        `**Total Command Tersedia:** ${client.commands.size}`,
                    "📊 Bot Statistics"
                )
            ]
        });
    }
};
