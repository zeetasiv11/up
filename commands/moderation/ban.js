const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban member dari server")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan di-ban").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan ban"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
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

        if (member && !member.bannable) {
            return interaction.reply({ embeds: [createErrorEmbed("Aku tidak bisa mem-ban user ini (role lebih tinggi/sama).")], ephemeral: true });
        }

        try {
            await interaction.guild.members.ban(target.id, { reason });
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "ban");
            await interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil di-ban.\n**Alasan:** ${reason}`, "🔨 Member Banned")] });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal ban: ${err.message}`)], ephemeral: true });
        }
    }
};
