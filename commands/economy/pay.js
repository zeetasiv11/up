const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Kirim coin ke user lain")
        .addUserOption((o) => o.setName("user").setDescription("Penerima").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Jumlah coin").setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (target.id === interaction.user.id) {
            return interaction.reply({ embeds: [createErrorEmbed("Kamu tidak bisa mengirim coin ke dirimu sendiri.")], ephemeral: true });
        }
        if (target.bot) {
            return interaction.reply({ embeds: [createErrorEmbed("Kamu tidak bisa mengirim coin ke bot.")], ephemeral: true });
        }

        const result = require("../../services/economy/economyService.js").transfer(interaction.user.id, target.id, amount);
        if (!result.ok) return interaction.reply({ embeds: [createErrorEmbed(result.error)], ephemeral: true });
        await db.flush();

        await interaction.reply({
            embeds: [createSuccessEmbed(`${interaction.user} mengirim ${settings.economy.currencyIcon} **${amount}** ke ${target}.`, "💸 Transfer Berhasil")]
        });
    }
};
