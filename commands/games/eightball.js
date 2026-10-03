const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

const ANSWERS = [
    "Ya, pasti.", "Kemungkinan besar iya.", "Sepertinya begitu.", "Tidak diragukan lagi.",
    "Fokus dan tanya lagi nanti.", "Coba tanya lagi nanti.", "Lebih baik tidak kuberitahu sekarang.",
    "Aku tidak bisa memprediksi ini.", "Jangan berharap.", "Sepertinya tidak.", "Kemungkinan besar tidak.", "Tidak."
];

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Tanyakan sesuatu ke bola ajaib")
        .addStringOption((o) => o.setName("question").setDescription("Pertanyaanmu").setRequired(true)),
    async execute(interaction) {
        const question = interaction.options.getString("question");
        const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
        await interaction.reply({ embeds: [createInfoEmbed(`**Pertanyaan:** ${question}\n**Jawaban:** ${answer}`, "🎱 Magic 8-Ball")] });
    }
};
