const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const stats = require("../../../services/economy/statsService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const coinflipEngine = require("../../../services/game/engines/coinflipEngine.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 5000;
const VALID_CHOICES = ["heads", "tails", "head", "tail"];

module.exports = {
    name: "coinflip",
    aliases: ["cf"],
    category: "games",
    description: "Tebak sisi koin",
    usage: "zcoinflip <heads|tails> <amount>",
    async execute(message, args) {
        const userId = message.author.id;
        const [choiceRaw, amountRaw] = args;

        if (!choiceRaw || !VALID_CHOICES.includes(choiceRaw.toLowerCase())) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zcoinflip <heads|tails> <amount>`")] });
        }

        const choice = choiceRaw.toLowerCase().startsWith("head") ? "heads" : "tails";
        const eco = economy.getEconomy(userId);
        const parsed = parseAmount(amountRaw, eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("coinflip", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Coinflip lagi.`)] });
        }

        economy.removeBalance(userId, parsed.amount);
        const { result, won, payout } = coinflipEngine.flip(choice, parsed.amount);
        if (won) economy.addBalance(userId, payout);
        stats.recordGameResult(userId, { won, wager: parsed.amount });
        logger.game(`Coinflip ${userId} choice=${choice} result=${result} won=${won}`);

        const resultEmoji = result === "heads" ? "🪙 Heads" : "🪙 Tails";
        const description = won
            ? `Hasil: **${resultEmoji}**\n\nKamu menang **${payout.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`
            : `Hasil: **${resultEmoji}**\n\nKamu kalah **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`;

        await message.reply({ embeds: [won ? createSuccessEmbed(description, "🪙 COINFLIP") : createInfoEmbed(description, "🪙 COINFLIP")] });
    }
};
