const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("shuffle").setDescription("Acak urutan lagu di antrian"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        if (queue.songs.length <= 2) {
            return interaction.reply({
                embeds: [createErrorEmbed("Antrian terlalu pendek untuk diacak.")],
                ephemeral: true
            });
        }

        await queue.shuffle();
        await interaction.reply({ embeds: [createSuccessEmbed("Antrian musik berhasil diacak.", "🔀 Shuffle")] });
    }
};
