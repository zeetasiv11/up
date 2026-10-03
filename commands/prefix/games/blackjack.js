const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const blackjackController = require("../../../services/game/controllers/blackjackController.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createErrorEmbed } = require("../../../utils/embeds.js");

const COOLDOWN_MS = 5000;

module.exports = {
    name: "ubj",
    aliases: ["bj", "blackjack"],
    category: "games",
    description: "Main Blackjack melawan dealer",
    usage: "zubj <amount|all|half>",
    async execute(message, args) {
        const userId = message.author.id;
        const eco = economy.getEconomy(userId);

        if (!args[0]) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zubj <amount>`\nContoh: `zubj 1000`, `zubj all`.")] });
        }

        const parsed = parseAmount(args[0], eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }

        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("blackjack", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Blackjack lagi.`)] });
        }

        // Escrow bet SEBELUM game dimulai (mencegah exploit balance negatif / double transaction)
        const result = await blackjackController.startGame(message, userId, parsed.amount);
        if (!result.ok) {
            // Gagal mulai (misal sudah ada sesi aktif) -> refund escrow
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }
    }
};
