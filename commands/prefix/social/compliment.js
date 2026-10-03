const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const COMPLIMENTS = [
    "kamu keren banget!",
    "senyummu bikin hari orang lebih baik.",
    "kamu pintar dan berbakat!",
    "kamu orang yang sangat baik hati.",
    "kehadiranmu selalu bikin suasana lebih hidup.",
    "kamu jago banget dalam apa yang kamu lakukan!"
];

module.exports = {
    name: "compliment",
    aliases: [],
    category: "social",
    description: "Beri pujian ke user lain",
    usage: "zcompliment @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zcompliment @user`")] });

        const line = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
        await message.reply({ embeds: [createInfoEmbed(`${target}, ${line} — dari ${message.author} 💫`, "💫 COMPLIMENT")] });
    }
};
