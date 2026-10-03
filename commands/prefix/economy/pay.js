const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "pay",
    aliases: ["give"],
    category: "economy",
    description: "Kirim coin ke user lain",
    usage: "zpay @user <amount>",
    async execute(message, args) {
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zpay @user <amount>`")] });
        }
        if (target.bot) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak bisa mengirim coin ke bot.")] });
        }

        const amountRaw = args.find((a) => !a.startsWith("<@"));
        const eco = economy.getEconomy(message.author.id);
        const parsed = parseAmount(amountRaw, eco.balance);
        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }

        const result = economy.transfer(message.author.id, target.id, parsed.amount);
        if (!result.ok) {
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }

        await require("../../../utils/database.js").flush();
        await message.reply({
            embeds: [createSuccessEmbed(`${message.author} mengirim **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon} ke ${target}.`, "💸 TRANSFER BERHASIL")]
        });
    }
};
