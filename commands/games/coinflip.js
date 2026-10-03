const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("coinflip").setDescription("Lempar koin"),
    async execute(interaction) {
        const result = Math.random() < 0.5 ? "Head 🪙" : "Tail 🪙";
        await interaction.reply({ embeds: [createInfoEmbed(`Hasilnya: **${result}**`, "🪙 Coinflip")] });
    }
};
