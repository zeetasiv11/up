const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Hapus sejumlah pesan di channel ini")
        .addIntegerOption((o) => o.setName("amount").setDescription("Jumlah pesan (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        try {
            const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger("amount"), true);
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "clear");
            await interaction.reply({ embeds: [createSuccessEmbed(`Berhasil menghapus ${deleted.size} pesan.`)], ephemeral: true });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal menghapus pesan (pesan lebih dari 14 hari tidak bisa dihapus massal): ${err.message}`)], ephemeral: true });
        }
    }
};
