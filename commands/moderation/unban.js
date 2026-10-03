const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban user dari server")
        .addStringOption((o) => o.setName("userid").setDescription("ID Discord user yang akan di-unban").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        const userId = interaction.options.getString("userid");
        try {
            await interaction.guild.members.unban(userId);
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "unban");
            await interaction.reply({ embeds: [createSuccessEmbed(`User dengan ID \`${userId}\` berhasil di-unban.`)] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal unban: ${err.message}`)], ephemeral: true });
        }
    }
};
