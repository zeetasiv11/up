const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");
const { setSleepTimer, clearSleepTimer, getSleepTimer, formatRemaining } = require("../../utils/musicFeatures.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sleeptimer")
        .setDescription("Atur musik berhenti otomatis")
        .addSubcommand((sub) =>
            sub
                .setName("set")
                .setDescription("Atur durasi sleep timer")
                .addIntegerOption((o) =>
                    o.setName("menit").setDescription("Berhenti setelah berapa menit").setRequired(true).setMinValue(1).setMaxValue(720)
                )
        )
        .addSubcommand((sub) => sub.setName("off").setDescription("Matikan sleep timer"))
        .addSubcommand((sub) => sub.setName("status").setDescription("Lihat status sleep timer")),
    category: "music",
    async execute(interaction) {
        const action = interaction.options.getSubcommand();

        if (action === "off") {
            const removed = clearSleepTimer(interaction.guildId);
            return interaction.reply({
                embeds: [
                    removed
                        ? createSuccessEmbed("Sleep timer dimatikan.", "⏰ Sleep Timer")
                        : createInfoEmbed("Tidak ada sleep timer yang aktif.", "⏰ Sleep Timer")
                ],
                ephemeral: true
            });
        }

        if (action === "status") {
            const timer = getSleepTimer(interaction.guildId);
            return interaction.reply({
                embeds: [
                    timer
                        ? createInfoEmbed(`Musik akan berhenti otomatis dalam **${formatRemaining(timer.remainingMs)}**.`, "⏰ Sleep Timer")
                        : createInfoEmbed("Tidak ada sleep timer yang aktif.", "⏰ Sleep Timer")
                ],
                ephemeral: true
            });
        }

        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        const queue = await requireQueue(interaction);
        if (!queue) return;

        const minutes = interaction.options.getInteger("menit", true);
        setSleepTimer(interaction.guildId, minutes, async () => {
            const activeQueue = interaction.client.distube?.getQueue(interaction.guildId);
            if (!activeQueue) return;
            const voice = activeQueue.voice;
            await activeQueue.stop();
            if (settings.music.leaveOnStop) await voice?.leave();
            await interaction.client.distube?.updateMusicPanel?.(activeQueue, null, "Sleep timer selesai. Musik dihentikan otomatis.");
        });

        return interaction.reply({
            embeds: [createSuccessEmbed(`Musik akan berhenti otomatis setelah **${minutes} menit**.`, "⏰ Sleep Timer Aktif")]
        });
    }
};