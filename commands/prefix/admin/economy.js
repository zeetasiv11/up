const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const { isAdmin } = require("../../../utils/permissions.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

module.exports = {
    name: "economy",
    aliases: [],
    category: "admin",
    description: "[ADMIN] Kelola economy user (set/add/remove/reset)",
    usage: "zeconomy set|add|remove|reset @user [amount]",
    async execute(message, args) {
        if (!isAdmin(message.member)) {
            return message.reply({ embeds: [createErrorEmbed("❌ Command ini khusus Administrator/Owner.")] });
        }

        const sub = (args[0] || "").toLowerCase();
        const target = message.mentions.users.first();

        if (!["set", "add", "remove", "reset"].includes(sub) || !target) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zeconomy set|add|remove|reset @user [amount]`")] });
        }

        const user = db.getUser(target.id);

        if (sub === "reset") {
            db.updateUser(target.id, { balance: 0, bank: 0 });
            logger.economy(`Admin ${message.author.id} reset economy untuk ${target.id}`);
            return message.reply({ embeds: [createSuccessEmbed(`Economy **${target.username}** berhasil direset.`, "🛠️ ADMIN ECONOMY")] });
        }

        const parsed = parseAmount(args[2], Number.MAX_SAFE_INTEGER);
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }

        let newBalance = user.balance || 0;
        if (sub === "set") newBalance = parsed.amount;
        if (sub === "add") newBalance += parsed.amount;
        if (sub === "remove") newBalance = Math.max(0, newBalance - parsed.amount);

        db.updateUser(target.id, { balance: newBalance });
        logger.economy(`Admin ${message.author.id} ${sub} ${parsed.amount} untuk ${target.id} (saldo baru: ${newBalance})`);

        await message.reply({
            embeds: [createSuccessEmbed(`Saldo **${target.username}** sekarang: **${newBalance.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}`, "🛠️ ADMIN ECONOMY")]
        });
    }
};
