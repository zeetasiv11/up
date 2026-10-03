const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Hapus timeout dari member")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan dihapus timeout-nya").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        const target = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.reply({ embeds: [createErrorEmbed("User tidak ditemukan di server ini.")], ephemeral: true });

        try {
            await member.timeout(null);
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "untimeout");
            await interaction.reply({ embeds: [createSuccessEmbed(`Timeout ${target.tag} telah dihapus.`)] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal: ${err.message}`)], ephemeral: true });
        }
    }
};
