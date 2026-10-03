const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "slap",
    aliases: [],
    category: "social",
    description: "Tampar user lain",
    usage: "zslap @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zslap @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`👋 ${message.author.username} menampar dirinya sendiri. Kenapa?`, "👋 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} menampar ${target}! 👋`, "👋 SOCIAL")] });
    }
};
