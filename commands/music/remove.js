const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Hapus lagu dari antrian berdasarkan nomor urutnya")
        .addIntegerOption((o) =>
            o.setName("nomor").setDescription("Nomor lagu di /queue (bukan lagu ke-0 yang sedang diputar)").setRequired(true).setMinValue(1)
        ),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        const index = interaction.options.getInteger("nomor", true);
        if (index >= queue.songs.length) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Nomor tidak valid. Antrian hanya punya ${queue.songs.length - 1} lagu selain yang sedang diputar.`)],
                ephemeral: true
            });
        }

        const removed = await queue.remove(index);
        await interaction.reply({
            embeds: [createSuccessEmbed(`**[${removed.name}](${removed.url})** dihapus dari antrian.`, "🗑️ Dihapus")]
        });
    }
};
