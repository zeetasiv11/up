const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "cuddle",
    aliases: [],
    category: "social",
    description: "Bermanja dengan user lain",
    usage: "zcuddle @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zcuddle @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`🥰 ${message.author.username} bermanja dengan dirinya sendiri.`, "🥰 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} bermanja dengan ${target}! 🥰`, "🥰 SOCIAL")] });
    }
};
