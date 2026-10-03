const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("ping").setDescription("Cek latency bot"),
    async execute(interaction) {
        const sent = await interaction.reply({ embeds: [createInfoEmbed("Menghitung ping...")], fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply({
            embeds: [createInfoEmbed(`🏓 **Pong!**\nLatency: **${latency}ms**\nAPI Latency: **${Math.round(interaction.client.ws.ping)}ms**`)]
        });
    }
};
