const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    modOnly: true,
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Beri peringatan kepada member")
        .addUserOption((o) => o.setName("user").setDescription("User yang akan diperingatkan").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Alasan warning").setRequired(true))
        .addStringOption(o => o.setName("evidence").setDescription("Evidence URL or reference").setMaxLength(1000))
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
        const reason = interaction.options.getString("reason");

        const warnings = db.addWarning(interaction.guild.id, target.id, {
            reason,
            moderator: interaction.user.tag,
            moderatorId: interaction.user.id,
            evidence: interaction.options.getString("evidence") || "",
            timestamp: Date.now()
        });

        await require("../../src/services/moderation/caseService").recordInteraction(interaction, "warn");
        await interaction.reply({ embeds: [createSuccessEmbed(`${target} telah diperingatkan.\n**Alasan:** ${reason}\n**Total warning:** ${warnings.length}`, "⚠️ Member Warned")] });
    }
};
