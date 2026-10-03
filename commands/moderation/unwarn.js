const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../utils/database");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds");
module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("unwarn")
        .setDescription("Hapus satu warning berdasarkan nomor di /warnings")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
        .addIntegerOption((option) =>
            option.setName("number").setDescription("Nomor warning").setRequired(true).setMinValue(1),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Alasan penghapusan").setMaxLength(1000),
        ),
    async execute(interaction) {
        const target = interaction.options.getUser("user"),
            index = interaction.options.getInteger("number") - 1;
        const warnings = db.getWarnings(interaction.guildId, target.id);
        if (!warnings[index])
            return interaction.reply({
                embeds: [createErrorEmbed("Warning tidak ditemukan.")],
                ephemeral: true,
            });
        warnings.splice(index, 1);
        await require("../../src/services/moderation/caseService").recordInteraction(interaction, "unwarn");
        return interaction.reply({
            embeds: [createSuccessEmbed("Warning dihapus dan dicatat dalam riwayat moderasi.")],
            ephemeral: true,
        });
    },
};
