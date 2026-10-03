const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Kunci channel ini (member tidak bisa kirim pesan)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "lock");
            await interaction.reply({ embeds: [createSuccessEmbed("🔒 Channel ini telah dikunci.")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal mengunci channel: ${err.message}`)], ephemeral: true });
        }
    }
};
