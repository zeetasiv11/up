const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder().setName("skip").setDescription("Lewati lagu yang sedang diputar"),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        if (queue.songs.length <= 1 && !queue.autoplay) {
            return interaction.reply({
                embeds: [createErrorEmbed("Tidak ada lagu selanjutnya di antrian. Aktifkan `/autoplay` atau tambah lagu dulu.")],
                ephemeral: true
            });
        }

        try {
            const song = await queue.skip();
            await interaction.reply({
                embeds: [createSuccessEmbed(`Lagu dilewati. Sekarang memutar: **[${song.name}](${song.url})**`, "⏭️ Skip")]
            });
        } catch (err) {
            await interaction.reply({ embeds: [createErrorEmbed(`Tidak bisa skip: \`${err.message}\``)], ephemeral: true });
        }
    }
};
