const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("replay").setDescription("Ulangi lagu yang sedang diputar dari awal"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        const song = queue.songs[0];
        if (song?.isLive) {
            return interaction.reply({
                embeds: [createErrorEmbed("Tidak bisa mengulang siaran live.")],
                ephemeral: true
            });
        }

        try {
            await queue.seek(0);
            await interaction.reply({
                embeds: [createSuccessEmbed(`**[${song?.name ?? "Lagu ini"}](${song?.url})** diulang dari awal.`, "🔁 Replay")]
            });
        } catch (err) {
            await interaction.reply({
                embeds: [createErrorEmbed(`Gagal mengulang lagu: \`${err.message}\``)],
                ephemeral: true
            });
        }
    }
};
