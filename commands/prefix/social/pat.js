const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "pat",
    aliases: [],
    category: "social",
    description: "Elus kepala user lain",
    usage: "zpat @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zpat @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`✋ ${message.author.username} mengelus kepalanya sendiri.`, "✋ SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} mengelus kepala ${target}! ✋`, "✋ SOCIAL")] });
    }
};
