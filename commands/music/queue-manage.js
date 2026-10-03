const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue-manage")
        .setDescription("Kelola urutan antrian musik")
        .addSubcommand((sub) => sub.setName("clear").setDescription("Hapus semua lagu yang menunggu"))
        .addSubcommand((sub) =>
            sub
                .setName("move")
                .setDescription("Pindahkan lagu dalam antrian")
                .addIntegerOption((o) => o.setName("dari").setDescription("Nomor lagu asal, mulai dari 1").setRequired(true).setMinValue(1).setMaxValue(300))
                .addIntegerOption((o) => o.setName("ke").setDescription("Nomor tujuan, mulai dari 1").setRequired(true).setMinValue(1).setMaxValue(300))
        ),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        const queue = await requireQueue(interaction);
        if (!queue) return;

        if (interaction.options.getSubcommand() === "clear") {
            const removed = await queue.clear();
            if (!removed.length) {
                return interaction.reply({ embeds: [createInfoEmbed("Belum ada lagu lain yang menunggu di antrian.", "🧹 Queue Management")], ephemeral: true });
            }
            await interaction.client.distube?.updateMusicPanel?.(queue, queue.songs[0]);
            return interaction.reply({ embeds: [createSuccessEmbed(`${removed.length} lagu dihapus dari antrian. Lagu yang sedang diputar tetap berjalan.`, "🧹 Antrian Dibersihkan")] });
        }

        const from = interaction.options.getInteger("dari", true);
        const to = interaction.options.getInteger("ke", true);
        const lastWaitingIndex = queue.songs.length - 1;
        if (from > lastWaitingIndex || to > lastWaitingIndex) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Nomor hanya boleh dari **1** sampai **${Math.max(lastWaitingIndex, 1)}**. Lagu nomor 0 sedang diputar.`)],
                ephemeral: true
            });
        }
        if (from === to) {
            return interaction.reply({ embeds: [createInfoEmbed("Posisi lagu sudah sama.", "↔️ Queue Management")], ephemeral: true });
        }

        const song = await queue.move(from, to);
        await interaction.client.distube?.updateMusicPanel?.(queue, queue.songs[0]);
        return interaction.reply({ embeds: [createSuccessEmbed(`**${song.name}** dipindahkan dari nomor **${from}** ke **${to}**.`, "↔️ Antrian Diubah")] });
    }
};