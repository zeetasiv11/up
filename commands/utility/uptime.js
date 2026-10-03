const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000) % 24;
    const days = Math.floor(ms / 86400000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    data: new SlashCommandBuilder().setName("uptime").setDescription("Lihat berapa lama bot sudah online"),
    async execute(interaction) {
        const uptime = Date.now() - (interaction.client.startedAt || Date.now());
        await interaction.reply({ embeds: [createInfoEmbed(`⏱️ Bot sudah online selama: **${formatUptime(uptime)}**`)] });
    }
};
