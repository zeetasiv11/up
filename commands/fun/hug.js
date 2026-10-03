const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName("hug")
        .setDescription("Peluk seseorang")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dipeluk").setRequired(true)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        await interaction.reply({ embeds: [createInfoEmbed(`${interaction.user} memeluk ${target} erat-erat! 🤗`, "🤗 Hug")] });
    }
};
