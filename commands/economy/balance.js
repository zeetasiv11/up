const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Lihat saldo kamu atau orang lain")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat saldonya")),
    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const user = db.getUser(target.id);
        await interaction.reply({
            embeds: [createInfoEmbed(`${settings.economy.currencyIcon} **${user.balance.toLocaleString("id-ID")}** ${settings.economy.currencyName}`, `💰 Saldo ${target.username}`)]
        });
    }
};
