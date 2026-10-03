const settings = require("../../../settings.js");
const { ITEMS } = require("../../../data/items.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "shop",
    aliases: [],
    category: "items",
    description: "Lihat item yang bisa dibeli",
    usage: "zshop",
    async execute(message) {
        const categories = {};
        for (const item of ITEMS) {
            if (item.price <= 0) continue; // skip item yang tidak dijual (reward-only)
            if (!categories[item.category]) categories[item.category] = [];
            categories[item.category].push(item);
        }

        const sections = Object.entries(categories).map(([cat, items]) => {
            const lines = items.map((i) => `${i.emoji} **${i.name}** — ${i.price.toLocaleString("id-ID")} ${settings.economy.currencyIcon}\n_${i.description}_`);
            return `**${cat.toUpperCase()}**\n${lines.join("\n")}`;
        });

        await message.reply({
            embeds: [createInfoEmbed(`${sections.join("\n\n")}\n\nGunakan \`zbuy <item>\` untuk membeli, \`zsell <item>\` untuk menjual.`, "🛒 ZEETASI SHOP")]
        });
    }
};
