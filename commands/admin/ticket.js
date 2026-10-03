const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    adminOnly: true,
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Kelola sistem ticket")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) => sub.setName("setup").setDescription("Kirim panel ticket di channel ini")),
    async execute(interaction) {
        await interaction.deferReply({ephemeral:true});
        await require("../../src/services/tickets/ticketService").publish(interaction.guild, interaction.channelId);
        await interaction.editReply({content:"Panel ticket siap."});
    }
};
