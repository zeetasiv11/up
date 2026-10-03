const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autoplay")
        .setDescription("Aktif/nonaktifkan autoplay (bot otomatis putar lagu terkait saat antrian habis)"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        const enabled = queue.toggleAutoplay();
        await interaction.reply({
            embeds: [
                createSuccessEmbed(
                    enabled
                        ? "Autoplay **diaktifkan**. Bot akan otomatis memutar lagu terkait saat antrian habis, seperti bot musik pada umumnya."
                        : "Autoplay **dinonaktifkan**.",
                    "▶️ Autoplay"
                )
            ]
        });
    }
};
