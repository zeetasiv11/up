const { SlashCommandBuilder } = require("discord.js");
const { createSuccessEmbed, createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remind")
        .setDescription("Buat pengingat")
        .addIntegerOption((o) => o.setName("minutes").setDescription("Ingatkan dalam berapa menit").setRequired(true).setMinValue(1).setMaxValue(10080))
        .addStringOption((o) => o.setName("message").setDescription("Pesan pengingat").setRequired(true)),
    async execute(interaction) {
        const minutes = interaction.options.getInteger("minutes");
        const message = interaction.options.getString("message");

        await interaction.reply({
            embeds: [createSuccessEmbed(`Oke, aku akan mengingatkanmu dalam **${minutes} menit**: "${message}"`, "⏰ Reminder Diset")]
        });

        setTimeout(async () => {
            await interaction.followUp({
                content: `${interaction.user}`,
                embeds: [createInfoEmbed(message, "⏰ Reminder!")]
            }).catch(() => {});
        }, minutes * 60 * 1000);
    }
};
