const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("support").setDescription("Informasi bantuan / support bot"),
    async execute(interaction) {
        await interaction.reply({
            embeds: [createInfoEmbed("Butuh bantuan? Hubungi admin server ini atau gunakan `/ticket` jika tersedia.", "🆘 Support")]
        });
    }
};
