const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick member dari server")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan di-kick").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan kick"))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "Tidak ada alasan diberikan";
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ embeds: [createErrorEmbed("User tidak ditemukan di server ini.")], ephemeral: true });
        if (!member.kickable) return interaction.reply({ embeds: [createErrorEmbed("Aku tidak bisa kick user ini.")], ephemeral: true });

        try {
            await member.kick(reason);
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "kick");
            await interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil di-kick.\n**Alasan:** ${reason}`, "👢 Member Kicked")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal kick: ${err.message}`)], ephemeral: true });
        }
    }
};
