const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

// Roasting ringan & bercanda saja — tidak menyinggung SARA/fisik/hal sensitif.
const ROASTS = [
    "cara main game-nya kayak lagi mode auto-lose.",
    "koneksi wifi kamu kayaknya lebih cepat dari otakmu mikir strategi zubj.",
    "sering banget kalah slots tapi tetep nekat main.",
    "kalau kalah zbattle jangan baper ya, cuma virtual pet kok.",
    "skill zubj kamu masih perlu banyak latihan, hehe."
];

module.exports = {
    name: "insult",
    aliases: ["roast"],
    category: "social",
    description: "Roasting santai ke user lain (bercanda, tidak menyinggung)",
    usage: "zinsult @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zinsult @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed("Ngeroasting diri sendiri? Santai aja bro 😂", "😂 ROAST")] });
        }

        const line = ROASTS[Math.floor(Math.random() * ROASTS.length)];
        await message.reply({ embeds: [createInfoEmbed(`${target}, ${line} (bercanda ya! 😂) — dari ${message.author}`, "😂 ROAST")] });
    }
};
