const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "withdraw",
    aliases: ["wd"],
    category: "economy",
    description: "Tarik coin dari bank",
    usage: "zwithdraw <amount|all|half>",
    async execute(message, args) {
        const eco = economy.getEconomy(message.author.id);
        const parsed = parseAmount(args[0], eco.bank);

        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }

        const result = economy.withdraw(message.author.id, parsed.amount);
        if (!result.ok) {
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }

        await message.reply({
            embeds: [createSuccessEmbed(`Berhasil menarik **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon} dari bank.`, "🏦 Withdraw Berhasil")]
        });
    }
};
