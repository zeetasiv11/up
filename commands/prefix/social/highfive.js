const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "highfive",
    aliases: ["hifive"],
    category: "social",
    description: "Tos dengan user lain",
    usage: "zhighfive @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zhighfive @user`")] });
        if (target.id === message.author.id) {
            return message.reply({ embeds: [createInfoEmbed(`🙌 ${message.author.username} tos dengan tangannya sendiri.`, "🙌 SOCIAL")] });
        }
        await message.reply({ embeds: [createInfoEmbed(`${message.author} tos dengan ${target}! 🙌`, "🙌 SOCIAL")] });
    }
};
