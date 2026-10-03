const cooldownManager = require("../../../services/game/cooldownManager.js");
const huntController = require("../../../services/game/controllers/huntController.js");
const { createErrorEmbed } = require("../../../utils/embeds.js");

const COOLDOWN_MS = 10 * 1000;

module.exports = {
    name: "hunt",
    aliases: [],
    category: "animals",
    description: "Pergi berburu animal",
    usage: "zhunt",
    async execute(message) {
        const userId = message.author.id;
        const remaining = cooldownManager.checkCooldown("hunt", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum hunting lagi.`)] });
        }
        await huntController.startHunt(message, userId);
    }
};
