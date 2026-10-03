const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const { parseAmount } = require("../../../utils/amountParser.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "deposit",
    aliases: ["dep"],
    category: "economy",
    description: "Simpan coin ke bank",
    usage: "zdeposit <amount|all|half>",
    async execute(message, args) {
        const eco = economy.getEconomy(message.author.id);
        const parsed = parseAmount(args[0], eco.balance);

        if (!parsed.ok) {
            return message.reply({ embeds: [createErrorEmbed(parsed.error)] });
        }

        const result = economy.deposit(message.author.id, parsed.amount);
        if (!result.ok) {
            return message.reply({ embeds: [createErrorEmbed(result.error)] });
        }

        await message.reply({
            embeds: [createSuccessEmbed(`Berhasil deposit **${parsed.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon} ke bank.`, "🏦 Deposit Berhasil")]
        });
    }
};
