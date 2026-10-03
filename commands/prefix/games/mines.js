const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const minesController = require("../../../services/game/controllers/minesController.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createErrorEmbed } = require("../../../utils/embeds.js");

const COOLDOWN_MS = 5000;
const MINES_CFG = settings.games?.mines || {};
const MIN_MINES = MINES_CFG.minMines ?? 1;
const MAX_MINES = MINES_CFG.maxMines ?? 15;
const DEFAULT_MINES = MINES_CFG.defaultMines ?? 4;

module.exports = {
    name: "mines",
    aliases: [],
    category: "games",
    description: "Main Mines, buka tile aman untuk multiplier lebih besar. Makin banyak mine yang diatur, makin gede multiplier per tile.",
    usage: "zmines <amount|all|half> [jumlah_mine]",
    async execute(message, args) {
        const userId = message.author.id;
        const eco = economy.getEconomy(userId);

        if (!args[0]) {
            return message.reply({
                embeds: [createErrorEmbed(
                    `Gunakan format: \`zmines <amount> [jumlah_mine]\`\n` +
                    `Contoh: \`zmines 1000\`, \`zmines 1m 1\`, \`zmines all 8\`.\n` +
                    `Jumlah mine: **${MIN_MINES}-${MAX_MINES}** (default **${DEFAULT_MINES}**). Makin banyak mine, makin besar multiplier tiap tile aman.`
                )]
            });
        }

        const parsed = parseAmount(args[0], eco.balance, { maxAllAmount: settings.economy.maxAllBet });
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }
        if (parsed.amount > eco.balance) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        // Jumlah mine bersifat opsional. Kalau tidak diisi -> pakai default dari settings.
        let mineCount = DEFAULT_MINES;
        if (args[1] !== undefined) {
            const rawMines = Number(args[1]);
            if (!Number.isInteger(rawMines) || rawMines < MIN_MINES || rawMines > MAX_MINES) {
                return message.reply({
                    embeds: [createErrorEmbed(`❌ Jumlah mine harus angka bulat antara **${MIN_MINES}** dan **${MAX_MINES}**.\nContoh: \`zmines ${args[0]} ${DEFAULT_MINES}\`.`)]
                });
            }
            mineCount = rawMines;
        }

        const remaining = cooldownManager.checkCooldown("mines", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Mines lagi.`)] });
        }

        const result = await minesController.startGame(message, userId, parsed.amount, mineCount);
        if (!result.ok) {
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }
    }
};
