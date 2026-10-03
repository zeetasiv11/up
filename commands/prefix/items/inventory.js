const inventoryService = require("../../../services/inventory/inventoryService.js");
const { getItem } = require("../../../data/items.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "inventory",
    aliases: ["inv"],
    category: "items",
    description: "Lihat isi inventory kamu",
    usage: "zinventory",
    async execute(message) {
        const inv = inventoryService.getInventory(message.author.id);
        const entries = Object.entries(inv).filter(([, qty]) => qty > 0);

        if (entries.length === 0) {
            return message.reply({ embeds: [createInfoEmbed("Inventory kamu kosong. Coba `zshop` untuk beli item.", "🎒 INVENTORY")] });
        }

        const lines = entries.map(([itemId, qty]) => {
            const item = getItem(itemId);
            if (!item) return `❓ ${itemId} x${qty}`;
            return `${item.emoji} **${item.name}** x${qty} — *${item.category}*`;
        });

        await message.reply({ embeds: [createInfoEmbed(lines.join("\n"), `🎒 ${message.author.username.toUpperCase()}'S INVENTORY`)] });
    }
};
