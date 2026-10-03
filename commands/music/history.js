const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel } = require("../../utils/musicChecks.js");
const { getHistory } = require("../../utils/musicFeatures.js");
const db = require("../../utils/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("Lihat riwayat musik server")
        .addSubcommand((sub) => sub.setName("list").setDescription("Lihat lagu yang baru diputar"))
        .addSubcommand((sub) =>
            sub
                .setName("play")
                .setDescription("Putar lagu dari riwayat")
                .addIntegerOption((o) => o.setName("nomor").setDescription("Nomor lagu dari /history list").setRequired(true).setMinValue(1).setMaxValue(50))
        )
        .addSubcommand((sub) => sub.setName("clear").setDescription("Hapus riwayat musik server")),
    category: "music",
    async execute(interaction) {
        const action = interaction.options.getSubcommand();
        const history = getHistory(interaction.guildId);

        if (action === "list") {
            const lines = history.map((song, index) => `**${index + 1}.** [${song.name}](${song.url}) \`${song.duration}\``);
            return interaction.reply({
                embeds: [createInfoEmbed(lines.length ? lines.join("\n") : "Belum ada riwayat lagu.", `🕘 Riwayat Musik (${history.length})`)],
                ephemeral: true
            });
        }

        if (action === "clear") {
            db.updateGuild(interaction.guildId, { musicHistory: [] });
            return interaction.reply({ embeds: [createSuccessEmbed("Riwayat musik server sudah dihapus.", "🧹 Riwayat Dihapus")], ephemeral: true });
        }

        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        const index = interaction.options.getInteger("nomor", true);
        const song = history[index - 1];
        if (!song) return interaction.reply({ embeds: [createErrorEmbed("Nomor riwayat tidak ditemukan.")], ephemeral: true });
        const distube = interaction.client.distube;
        if (!distube) return interaction.reply({ embeds: [createErrorEmbed("Fitur musik sedang tidak aktif.")], ephemeral: true });

        await interaction.deferReply();
        try {
            await distube.play(interaction.member.voice.channel, song.url, {
                textChannel: interaction.channel,
                member: interaction.member
            });
            return interaction.editReply({ embeds: [createSuccessEmbed(`**${song.name}** dimasukkan ke antrian dari riwayat.`, "▶️ Memutar Riwayat")] });
        } catch (err) {
            return interaction.editReply({ embeds: [createErrorEmbed(`Gagal memutar lagu riwayat: \`${err.message}\``)] });
        }
    }
};