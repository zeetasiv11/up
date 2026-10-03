const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "roll",
    aliases: [],
    category: "fun",
    description: "Roll angka random (default 1-100)",
    usage: "zroll [min-max]",
    async execute(message, args) {
        let min = 1;
        let max = 100;

        if (args[0]) {
            const match = args[0].match(/^(-?\d+)-(-?\d+)$/);
            if (!match) {
                return message.reply({ embeds: [createErrorEmbed("Format range salah. Contoh: `zroll 1-100`")] });
            }
            min = parseInt(match[1], 10);
            max = parseInt(match[2], 10);
            if (min >= max) {
                return message.reply({ embeds: [createErrorEmbed("❌ Nilai minimum harus lebih kecil dari maksimum.")] });
            }
        }

        const result = min + Math.floor(Math.random() * (max - min + 1));
        await message.reply({ embeds: [createInfoEmbed(`🎲 Kamu mendapatkan: **${result}** (range ${min}-${max})`, "🎲 ROLL")] });
    }
};
