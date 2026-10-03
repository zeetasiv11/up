const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("invite").setDescription("Dapatkan link untuk mengundang bot ini"),
    async execute(interaction) {
        const link = `https://discord.com/api/oauth2/authorize?client_id=${settings.clientId}&permissions=8&scope=bot%20applications.commands`;
        await interaction.reply({ embeds: [createInfoEmbed(`[Klik di sini untuk mengundang ${settings.botName}](${link})`, "🔗 Invite Bot")] });
    }
};
