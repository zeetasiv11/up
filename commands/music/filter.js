const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("filter")
        .setDescription("Aktif/nonaktifkan filter audio")
        .addStringOption((o) =>
            o
                .setName("nama")
                .setDescription("Filter yang ingin diterapkan")
                .setRequired(true)
                .addChoices(
                    { name: "Bassboost", value: "bassboost" },
                    { name: "Nightcore", value: "nightcore" },
                    { name: "Vaporwave", value: "vaporwave" },
                    { name: "8D", value: "8d" },
                    { name: "Karaoke", value: "karaoke" },
                    { name: "Tremolo", value: "tremolo" },
                    { name: "Vibrato", value: "vibrato" },
                    { name: "Lowpass", value: "lowpass" },
                    { name: "Rotation", value: "rotation" },
                    { name: "Distortion", value: "distortion" },
                    { name: "Equalizer", value: "equalizer" },
                    { name: "Pop (bass + treble)", value: "pop" },
                    { name: "Soft / Muffled", value: "soft" },
                    { name: "Treble Boost", value: "treble" },
                    { name: "Matikan Semua Filter", value: "off" }
                )
        ),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        }

        const queue = await requireQueue(interaction);
        if (!queue) return;

        const name = interaction.options.getString("nama", true);

        try {
            if (name === "off") {
                await queue.filters.clear();
                return interaction.reply({ embeds: [createSuccessEmbed("Semua filter audio dimatikan.", "🎛️ Filter")] });
            }

            if (queue.filters.has(name)) {
                await queue.filters.remove(name);
                return interaction.reply({ embeds: [createSuccessEmbed(`Filter **${name}** dimatikan.`, "🎛️ Filter")] });
            }

            await queue.filters.add(name);
            await interaction.reply({ embeds: [createSuccessEmbed(`Filter **${name}** diaktifkan.`, "🎛️ Filter")] });
        } catch (err) {
            await interaction.reply({
                embeds: [createErrorEmbed(`Gagal menerapkan filter: \`${err.message}\``)],
                ephemeral: true
            });
        }
    }
};
