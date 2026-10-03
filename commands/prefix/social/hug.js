const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "hug",
    aliases: [],
    category: "social",
    description: "Peluk user lain",
    usage: "zhug @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zhug @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`🤗 ${message.author.username} memeluk dirinya sendiri... unik.`, "🤗 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} memeluk ${target}! 🤗`, "🤗 SOCIAL")] });
    }
};
