const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎"];

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("slots")
        .setDescription("Main slot machine dengan taruhan coin")
        .addIntegerOption((o) => o.setName("bet").setDescription("Jumlah taruhan").setRequired(true).setMinValue(10)),
    async execute(interaction) {
        const bet = interaction.options.getInteger("bet");
        const user = db.getUser(interaction.user.id);

        if (user.balance < bet) {
            return interaction.reply({ embeds: [createErrorEmbed(`Saldo kamu tidak cukup. Saldo saat ini: ${settings.economy.currencyIcon} ${user.balance}`)], ephemeral: true });
        }

        const spin = [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        const display = spin.join(" | ");

        let winnings = 0;
        if (spin[0] === spin[1] && spin[1] === spin[2]) winnings = bet * 5;
        else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) winnings = bet * 2;

        const newBalance = user.balance - bet + winnings;
        db.updateUser(interaction.user.id, { balance: newBalance });

        const resultText =
            winnings > 0
                ? `**[ ${display} ]**\n\nKamu menang ${settings.economy.currencyIcon} **${winnings}**!`
                : `**[ ${display} ]**\n\nKamu kalah ${settings.economy.currencyIcon} **${bet}**.`;

        await interaction.reply({
            embeds: [winnings > 0 ? createSuccessEmbed(resultText, "🎰 Slots") : createInfoEmbed(resultText, "🎰 Slots")]
        });
    }
};
