const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("dice")
        .setDescription("Lempar dadu")
        .addIntegerOption((o) => o.setName("sides").setDescription("Jumlah sisi dadu (default 6)").setMinValue(2).setMaxValue(100)),
    async execute(interaction) {
        const sides = interaction.options.getInteger("sides") || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await interaction.reply({ embeds: [createInfoEmbed(`Dadu (${sides} sisi) menunjukkan angka: **${result}** 🎲`, "🎲 Dice")] });
    }
};
