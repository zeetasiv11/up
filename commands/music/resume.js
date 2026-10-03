const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("resume").setDescription("Lanjutkan musik yang sedang dijeda"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        if (!queue.paused) {
            return interaction.reply({ embeds: [createWarningEmbed("Musik sedang tidak dijeda.")], ephemeral: true });
        }

        await queue.resume();
        await interaction.reply({ embeds: [createSuccessEmbed("Musik dilanjutkan.", "▶️ Resume")] });
    }
};
