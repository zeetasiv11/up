const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const stats = require("../../../services/economy/statsService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const slotsEngine = require("../../../services/game/engines/slotsEngine.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 5000;

module.exports = {
    name: "slots",
    aliases: ["slot"],
    category: "games",
    description: "Main slot machine",
    usage: "zslots <amount|all|half>",
    async execute(message, args) {
        const userId = message.author.id;
        const eco = economy.getEconomy(userId);

        if (!args[0]) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zslots <amount>`\nContoh: `zslots 1000`.")] });
        }

        const parsed = parseAmount(args[0], eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("slots", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Slots lagi.`)] });
        }

        economy.removeBalance(userId, parsed.amount);
        const { reels, payout, won } = slotsEngine.spin(parsed.amount);
        if (won) economy.addBalance(userId, payout);
        stats.recordGameResult(userId, { won, wager: parsed.amount });
        logger.game(`Slots ${userId} bet=${parsed.amount} won=${won} payout=${payout}`);

        const display = reels.join(" | ");
        const description = won
            ? `**[ ${display} ]**\n\nKamu menang **${payout.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`
            : `**[ ${display} ]**\n\nKamu kalah **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`;

        await message.reply({ embeds: [won ? createSuccessEmbed(description, "🎰 SLOTS") : createInfoEmbed(description, "🎰 SLOTS")] });
    }
};
