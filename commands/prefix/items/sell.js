const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const inventoryService = require("../../../services/inventory/inventoryService.js");
const { findByNameOrId } = require("../../../data/items.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const SELL_RATE = 0.5; // jual balik 50% dari harga beli

module.exports = {
    name: "sell",
    aliases: [],
    category: "items",
    description: "Jual item dari inventory",
    usage: "zsell <item> [jumlah]",
    async execute(message, args) {
        if (!args[0]) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zsell <nama item> [jumlah]`")] });
        }

        const qty = Number.isInteger(parseInt(args[args.length - 1], 10)) && args.length > 1 ? parseInt(args.pop(), 10) : 1;
        const query = args.join(" ");
        const item = findByNameOrId(query);

        if (!item) {
            return message.reply({ embeds: [createErrorEmbed(`❌ Item \`${query}\` tidak dikenali.`)] });
        }
        if (qty <= 0) {
            return message.reply({ embeds: [createErrorEmbed("❌ Jumlah tidak valid.")] });
        }

        const removed = inventoryService.removeItem(message.author.id, item.id, qty);
        if (!removed) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak punya item ini sejumlah itu di inventory.")] });
        }

        const sellPrice = Math.floor(item.price * SELL_RATE) * qty;
        economy.addBalance(message.author.id, sellPrice);

        await message.reply({
            embeds: [createSuccessEmbed(`Kamu menjual **${item.emoji} ${item.name}** x${qty} seharga **${sellPrice.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`, "🛒 PENJUALAN BERHASIL")]
        });
    }
};
