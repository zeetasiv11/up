const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("rps").setDescription("Main Rock Paper Scissors melawan bot"),
    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rps_rock_${interaction.user.id}`).setEmoji("✊").setLabel("Rock").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rps_paper_${interaction.user.id}`).setEmoji("✋").setLabel("Paper").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rps_scissors_${interaction.user.id}`).setEmoji("✌️").setLabel("Scissors").setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [createInfoEmbed("Pilih salah satu!", "✊✋✌️ Rock Paper Scissors")], components: [row] });
    }
};
