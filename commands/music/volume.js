const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed, createInfoEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Atur volume musik (0-150)")
        .addIntegerOption((o) =>
            o.setName("level").setDescription("Level volume yang diinginkan").setMinValue(0).setMaxValue(150)
        ),
    category: "music",
    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (!queue) return;

        const level = interaction.options.getInteger("level");
        if (level === null) {
            return interaction.reply({ embeds: [createInfoEmbed(`Volume saat ini: \`${queue.volume}%\``, "🔊 Volume")] });
        }

        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        await queue.setVolume(level);
        await interaction.reply({ embeds: [createSuccessEmbed(`Volume diatur ke \`${level}%\`.`, "🔊 Volume")] });
    }
};
