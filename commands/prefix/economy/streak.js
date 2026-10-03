const db = require("../../../utils/database.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "streak",
    aliases: [],
    category: "economy",
    description: "Lihat daily streak kamu",
    usage: "zstreak",
    async execute(message) {
        const user = db.getUser(message.author.id);
        await message.reply({ embeds: [createInfoEmbed(`Daily streak kamu saat ini: **${user.dailyStreak || 0}** 🔥`, "🔥 DAILY STREAK")] });
    }
};
