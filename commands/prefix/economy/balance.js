const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const economy = require("../../../services/economy/economyService.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");
const { ansiBlock, dc } = require("../../../utils/colors.js");

function statLine(label, value, color) {
    return `${label.padEnd(8, " ")}: ${dc(value, color, true)}`;
}

module.exports = {
    name: "cash",
    aliases: ["bal", "balance"],
    category: "economy",
    description: "Lihat saldo coin kamu",
    usage: "zcash [@user]",
    async execute(message) {
        const target = message.mentions.users.first() || message.author;
        const eco = economy.getEconomy(target.id);
        const user = db.getUser(target.id);

        const block = [
            statLine("Coins", `${eco.balance.toLocaleString("id-ID")} ${settings.economy.currencyIcon}`, "yellow"),
            statLine("Bank", `${eco.bank.toLocaleString("id-ID")} ${settings.economy.currencyIcon}`, "cyan"),
            statLine("Level", `${user.level || 0}`, "green")
        ].join("\n");

        const description = ansiBlock(block);

        await message.reply({
            embeds: [createInfoEmbed(description, `💰 ${target.username.toUpperCase()}'S BALANCE`)]
        });
    }
};
