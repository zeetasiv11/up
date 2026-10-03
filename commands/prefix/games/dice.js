const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const stats = require("../../../services/economy/statsService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const diceEngine = require("../../../services/game/engines/diceEngine.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 5000;

module.exports = {
    name: "dice",
    aliases: [],
    category: "games",
    description: "Tebak dadu (high/low/exact)",
    usage: "zdice <amount> <high|low|exact> [angka jika exact]",
    async execute(message, args) {
        const userId = message.author.id;
        const [amountRaw, choiceRaw, exactRaw] = args;
        const choice = (choiceRaw || "").toLowerCase();

        if (!amountRaw || !["high", "low", "exact"].includes(choice)) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zdice <amount> <high|low|exact> [angka]`\nContoh: `zdice 1000 high`, `zdice 1000 exact 42`.")] });
        }

        let exactGuess = null;
        if (choice === "exact") {
            exactGuess = parseInt(exactRaw, 10);
            if (!Number.isFinite(exactGuess) || exactGuess < 1 || exactGuess > 100) {
                return message.reply({ embeds: [createErrorEmbed("❌ Untuk mode `exact`, masukkan angka 1-100. Contoh: `zdice 1000 exact 42`.")] });
            }
        }

        const eco = economy.getEconomy(userId);
        const parsed = parseAmount(amountRaw, eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("dice", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Dice lagi.`)] });
        }

        economy.removeBalance(userId, parsed.amount);
        const { result, won, payout } = diceEngine.roll(choice, parsed.amount, exactGuess);
        if (won) economy.addBalance(userId, payout);
        stats.recordGameResult(userId, { won, wager: parsed.amount });
        logger.game(`Dice ${userId} choice=${choice} result=${result} won=${won}`);

        const description = won
            ? `🎲 Dadu: **${result}**\n\nKamu menang **${payout.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`
            : `🎲 Dadu: **${result}**\n\nKamu kalah **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`;

        await message.reply({ embeds: [won ? createSuccessEmbed(description, "🎲 DICE") : createInfoEmbed(description, "🎲 DICE")] });
    }
};
