const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "kiss",
    aliases: [],
    category: "social",
    description: "Cium user lain",
    usage: "zkiss @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zkiss @user`")] });
        if (target.bot) return message.reply({ embeds: [createErrorEmbed("❌ Tidak bisa mencium bot.")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`😘 ${message.author.username} mencium cermin.`, "😘 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} mencium ${target}! 😘`, "😘 SOCIAL")] });
    }
};
