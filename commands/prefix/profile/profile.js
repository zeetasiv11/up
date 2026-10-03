const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const economy = require("../../../services/economy/economyService.js");
const statsService = require("../../../services/economy/statsService.js");
const animalService = require("../../../services/animals/animalService.js");
const petService = require("../../../services/pets/petService.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

function xpForLevel(level) {
    return 5 * level ** 2 + 50 * level + 100;
}

module.exports = {
    name: "profile",
    aliases: ["prof"],
    category: "profile",
    description: "Lihat profile lengkap kamu",
    usage: "zprofile [@user]",
    async execute(message) {
        const target = message.mentions.users.first() || message.author;
        const user = db.getUser(target.id);
        const eco = economy.getEconomy(target.id);
        const gambling = statsService.getStats(target.id);
        const animals = animalService.getAnimals(target.id);
        const pets = petService.getPets(target.id);
        const badges = user.badges || [];

        const description =
            `Level **${user.level || 0}** — XP ${user.xp || 0}/${xpForLevel(user.level || 0)}\n\n` +
            `💰 Coins: **${eco.balance.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n` +
            `🏦 Bank: **${eco.bank.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n` +
            `🔥 Daily Streak: **${user.dailyStreak || 0}**\n\n` +
            `🐾 Animals: **${animals.length}**\n` +
            `🐶 Pets: **${pets.length}**\n\n` +
            `🎮 Games: **${gambling.gamesPlayed}** (W:${gambling.wins} / L:${gambling.losses})\n` +
            `⚔️ Battles: W:${user.battle?.wins || 0} / L:${user.battle?.losses || 0}\n\n` +
            `🎖️ Badges: ${badges.length > 0 ? badges.join(", ") : "Belum ada"}\n` +
            `💍 Married to: ${user.marriage?.partnerId ? `<@${user.marriage.partnerId}>` : "-"}`;

        await message.reply({ embeds: [createInfoEmbed(description, `👤 ${target.username.toUpperCase()}'S PROFILE`)] });
    }
};
