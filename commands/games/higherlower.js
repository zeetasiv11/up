const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("higherlower").setDescription("Tebak apakah angka selanjutnya lebih tinggi atau lebih rendah"),
    async execute(interaction) {
        const start = Math.floor(Math.random() * 100) + 1;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`higherlower_higher_${interaction.user.id}_${start}`).setLabel("⬆️ Higher").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`higherlower_lower_${interaction.user.id}_${start}`).setLabel("⬇️ Lower").setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            embeds: [createSuccessEmbed(`Angka sekarang: **${start}**. Tebak, angka selanjutnya lebih tinggi atau lebih rendah?`, "🔢 Higher or Lower")],
            components: [row]
        });
    }
};
