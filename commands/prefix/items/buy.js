const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const inventoryService = require("../../../services/inventory/inventoryService.js");
const { findByNameOrId } = require("../../../data/items.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "buy",
    aliases: [],
    category: "items",
    description: "Beli item dari shop",
    usage: "zbuy <item> [jumlah]",
    async execute(message, args) {
        if (!args[0]) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zbuy <nama item> [jumlah]`\nContoh: `zbuy crate_basic 2`")] });
        }

        const qty = Number.isInteger(parseInt(args[args.length - 1], 10)) && args.length > 1 ? parseInt(args.pop(), 10) : 1;
        const query = args.join(" ");
        const item = findByNameOrId(query);

        if (!item || item.price <= 0) {
            return message.reply({ embeds: [createErrorEmbed(`❌ Item \`${query}\` tidak ditemukan di shop.`)] });
        }
        if (qty <= 0 || qty > 99) {
            return message.reply({ embeds: [createErrorEmbed("❌ Jumlah pembelian tidak valid (1-99).")] });
        }

        const totalCost = item.price * qty;
        const removed = economy.removeBalance(message.author.id, totalCost);
        if (!removed) {
            return message.reply({ embeds: [createErrorEmbed("❌ Saldo cash kamu tidak cukup.")] });
        }

        inventoryService.addItem(message.author.id, item.id, qty);
        await message.reply({
            embeds: [createSuccessEmbed(`Kamu membeli **${item.emoji} ${item.name}** x${qty} seharga **${totalCost.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`, "🛒 PEMBELIAN BERHASIL")]
        });
    }
};
