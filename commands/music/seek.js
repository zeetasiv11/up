const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

/**
 * Parse "mm:ss", "hh:mm:ss", atau angka detik polos ("90") jadi total detik.
 * Return null kalau formatnya tidak valid.
 */
function parseTimeToSeconds(input) {
    const trimmed = input.trim();

    if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10);
    }

    const parts = trimmed.split(":").map((p) => p.trim());
    if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) {
        return null;
    }

    const nums = parts.map((p) => parseInt(p, 10));
    let seconds = 0;
    for (const n of nums) {
        seconds = seconds * 60 + n;
    }
    return seconds;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seek")
        .setDescription("Lompat ke posisi waktu tertentu di lagu yang sedang diputar")
        .addStringOption((o) =>
            o
                .setName("waktu")
                .setDescription("Format: detik (90), mm:ss (1:30), atau hh:mm:ss (1:02:00)")
                .setRequired(true)
        ),
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
                embeds: [createErrorEmbed("Tidak bisa seek di siaran live.")],
                ephemeral: true
            });
        }

        const raw = interaction.options.getString("waktu", true);
        const seconds = parseTimeToSeconds(raw);

        if (seconds === null || seconds < 0) {
            return interaction.reply({
                embeds: [createErrorEmbed("Format waktu tidak valid. Contoh: `90`, `1:30`, atau `1:02:00`.")],
                ephemeral: true
            });
        }

        if (song?.duration && seconds > song.duration) {
            return interaction.reply({
                embeds: [
                    createErrorEmbed(
                        `Waktu melebihi durasi lagu (\`${song.formattedDuration ?? "??:??"}\`).`
                    )
                ],
                ephemeral: true
            });
        }

        try {
            await queue.seek(seconds);
            await interaction.reply({
                embeds: [createSuccessEmbed(`Lompat ke \`${raw}\` di lagu yang sedang diputar.`, "⏩ Seek")]
            });
        } catch (err) {
            await interaction.reply({
                embeds: [createErrorEmbed(`Gagal seek: \`${err.message}\``)],
                ephemeral: true
            });
        }
    }
};
