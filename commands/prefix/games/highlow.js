const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const highlowController = require("../../../services/game/controllers/highlowController.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createErrorEmbed } = require("../../../utils/embeds.js");

const COOLDOWN_MS = 5000;

module.exports = {
    name: "highlow",
    aliases: ["hl"],
    category: "games",
    description: "Tebak kartu berikutnya lebih tinggi/rendah",
    usage: "zhighlow <amount>",
    async execute(message, args) {
        const userId = message.author.id;
        const eco = economy.getEconomy(userId);

        if (!args[0]) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zhighlow <amount>`")] });
        }

        const parsed = parseAmount(args[0], eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("highlow", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main HighLow lagi.`)] });
        }

        const result = await highlowController.startGame(message, userId, parsed.amount);
        if (!result.ok) {
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }
    }
};
