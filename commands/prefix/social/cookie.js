const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "cookie",
    aliases: [],
    category: "social",
    description: "Beri cookie ke user lain",
    usage: "zcookie @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zcookie @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`🍪 ${message.author.username} makan cookie sendirian.`, "🍪 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} memberi cookie ke ${target}! 🍪`, "🍪 SOCIAL")] });
    }
};
