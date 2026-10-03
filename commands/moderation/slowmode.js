const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Atur slowmode channel ini")
        .addIntegerOption((o) => o.setName("seconds").setDescription("Detik (0 untuk mematikan)").setRequired(true).setMinValue(0).setMaxValue(21600))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const targetUser = interaction.options.getUser?.("user");
        if (targetUser) {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (targetUser.id === interaction.guild.ownerId || (targetMember && interaction.user.id !== interaction.guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position)) {
                return interaction.reply({ content: "Target berada pada role yang sama atau lebih tinggi dari kamu.", ephemeral: true });
            }
        }
        const seconds = interaction.options.getInteger("seconds");
        try {
            await interaction.channel.setRateLimitPerUser(seconds);
            await require("../../src/services/moderation/caseService").recordInteraction(interaction, "slowmode");
            await interaction.reply({
                embeds: [createSuccessEmbed(
                    seconds === 0 ? "Slowmode dimatikan di channel ini." : `Slowmode diatur menjadi **${seconds} detik**.`
                )]
            });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Gagal: ${err.message}`)], ephemeral: true });
        }
    }
};
