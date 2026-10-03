const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("leave").setDescription("Keluarkan bot dari voice channel"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        await interaction.client.music.leave(interaction.guildId);
        await interaction.reply({ embeds: [createSuccessEmbed("Bot keluar dari voice channel.", "👋 Leave")] });
    }
};
