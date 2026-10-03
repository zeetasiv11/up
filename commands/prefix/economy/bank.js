const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "bank",
    aliases: [],
    category: "economy",
    description: "Lihat saldo bank kamu",
    usage: "zbank",
    async execute(message) {
        const eco = economy.getEconomy(message.author.id);
        const description =
            `Cash:\n**${eco.balance.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n\n` +
            `Bank:\n**${eco.bank.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n\n` +
            `Gunakan \`zdeposit <amount>\` atau \`zwithdraw <amount>\`.`;

        await message.reply({ embeds: [createInfoEmbed(description, "🏦 BANK")] });
    }
};
