const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const stats = require("../../../services/economy/statsService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const rouletteEngine = require("../../../services/game/engines/rouletteEngine.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 5000;

function parseBet(raw) {
    const val = (raw || "").toLowerCase();
    if (val === "red" || val === "black" || val === "green") return val;
    const n = parseInt(val, 10);
    if (Number.isInteger(n) && n >= 0 && n <= 36) return n;
    return null;
}

module.exports = {
    name: "roulette",
    aliases: [],
    category: "games",
    description: "Main roulette (red/black/green/angka)",
    usage: "zroulette <red|black|green|0-36> <amount>",
    async execute(message, args) {
        const userId = message.author.id;
        const [betRaw, amountRaw] = args;
        const bet = parseBet(betRaw);

        if (bet === null) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zroulette <red|black|green|0-36> <amount>`")] });
        }

        const eco = economy.getEconomy(userId);
        const parsed = parseAmount(amountRaw, eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        const remaining = cooldownManager.checkCooldown("roulette", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Roulette lagi.`)] });
        }

        economy.removeBalance(userId, parsed.amount);
        const { number, color, won, payout } = rouletteEngine.spin(bet, parsed.amount);
        if (won) economy.addBalance(userId, payout);
        stats.recordGameResult(userId, { won, wager: parsed.amount });
        logger.game(`Roulette ${userId} bet=${bet} number=${number} color=${color} won=${won}`);

        const colorEmoji = color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";
        const description = won
            ? `Bola jatuh di: **${number} ${colorEmoji}**\n\nKamu menang **${payout.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`
            : `Bola jatuh di: **${number} ${colorEmoji}**\n\nKamu kalah **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`;

        await message.reply({ embeds: [won ? createSuccessEmbed(description, "🎡 ROULETTE") : createInfoEmbed(description, "🎡 ROULETTE")] });
    }
};
