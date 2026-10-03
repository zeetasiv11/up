const settings = require("../../../settings.js");
const lotteryService = require("../../../services/economy/lotteryService.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "lottery",
    aliases: ["lotre"],
    category: "games",
    description: "Beli tiket lottery harian (virtual currency)",
    usage: "zlottery | zlottery buy <jumlah> | zlottery info",
    async execute(message, args) {
        const sub = (args[0] || "info").toLowerCase();
        const userId = message.author.id;

        if (sub === "buy") {
            const count = parseInt(args[1], 10) || 1;
            const result = lotteryService.buyTickets(userId, count);
            if (!result.ok) {
                return message.reply({ embeds: [createErrorEmbed(result.error)] });
            }
            return message.reply({
                embeds: [createSuccessEmbed(
                    `Kamu membeli **${count}** tiket seharga **${result.cost.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.\n\nTotal pot hari ini: **${result.round.pot.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}`,
                    "🎟️ LOTTERY"
                )]
            });
        }

        // info (default)
        const round = lotteryService.getRound();
        const myTickets = round.tickets[userId] || 0;
        const totalTickets = Object.values(round.tickets).reduce((a, b) => a + b, 0);
        const winChance = totalTickets > 0 ? ((myTickets / totalTickets) * 100).toFixed(1) : "0.0";

        let description =
            `Harga tiket: **${lotteryService.TICKET_PRICE.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n` +
            `Pot hari ini: **${round.pot.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n` +
            `Total tiket terjual: **${totalTickets}**\n\n` +
            `Tiket kamu: **${myTickets}** (${winChance}% peluang menang)\n\n` +
            `Draw otomatis setiap pergantian hari.\nGunakan \`zlottery buy <jumlah>\` untuk beli tiket.`;

        if (round.lastWinnerId) {
            description += `\n\n🏆 Pemenang terakhir: <@${round.lastWinnerId}> memenangkan **${round.lastPot.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`;
        }

        await message.reply({ embeds: [createInfoEmbed(description, "🎟️ LOTTERY")] });
    }
};
