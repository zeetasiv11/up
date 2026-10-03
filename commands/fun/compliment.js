const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

const COMPLIMENTS = [
    "kamu keren banget hari ini!",
    "senyummu bikin server ini lebih cerah!",
    "kamu selalu bawa energi positif ke sini!",
    "kerja kerasmu selalu keliatan kok!",
    "kamu orang yang menyenangkan untuk diajak ngobrol!"
];

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName("compliment")
        .setDescription("Beri pujian ke seseorang")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dipuji").setRequired(true)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
        await interaction.reply({ embeds: [createInfoEmbed(`Hei ${target}, ${compliment}`, "✨ Compliment")] });
    }
};
