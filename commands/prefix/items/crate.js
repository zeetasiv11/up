const settings = require("../../../settings.js");
const inventoryService = require("../../../services/inventory/inventoryService.js");
const crateService = require("../../../services/economy/crateService.js");
const { getItem } = require("../../../data/items.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "crate",
    aliases: [],
    category: "items",
    description: "Buka crate yang kamu punya",
    usage: "zcrate open <crateId>",
    async execute(message, args) {
        const sub = (args[0] || "").toLowerCase();
        const userId = message.author.id;

        if (sub !== "open" || !args[1]) {
            const owned = Object.keys(crateService.CRATE_TABLES).filter((id) => inventoryService.hasItem(userId, id, 1));
            if (owned.length === 0) {
                return message.reply({ embeds: [createInfoEmbed("Kamu belum punya crate. Beli di `zshop`.", "🎁 CRATE")] });
            }
            const lines = owned.map((id) => `${getItem(id).emoji} **${getItem(id).name}** x${inventoryService.getQty(userId, id)} — \`zcrate open ${id}\``);
            return message.reply({ embeds: [createInfoEmbed(lines.join("\n"), "🎁 CRATE KAMU")] });
        }

        const crateId = args[1].toLowerCase();
        const item = getItem(crateId);
        if (!item || item.category !== "Crate") {
            return message.reply({ embeds: [createErrorEmbed("❌ Crate tidak valid.")] });
        }

        const removed = inventoryService.removeItem(userId, crateId, 1);
        if (!removed) {
            return message.reply({ embeds: [createErrorEmbed(`❌ Kamu tidak punya **${item.name}**.`)] });
        }

        const result = crateService.openCrate(userId, crateId);
        if (!result.ok) {
            inventoryService.addItem(userId, crateId, 1); // refund kalau gagal
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }

        const lines = result.rewards.map((r) => {
            if (r.type === "coin") return `🪙 **${r.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}`;
            if (r.type === "animal") return `${r.emoji} **${r.name}** (${r.rarity})`;
            if (r.type === "item") return `📦 **${getItem(r.itemId)?.name || r.itemId}**`;
            return "";
        });

        await message.reply({
            embeds: [createSuccessEmbed(`Kamu membuka **${item.name}** dan mendapatkan:\n\n${lines.join("\n")}`, "🎁 CRATE OPENED")]
        });
    }
};
