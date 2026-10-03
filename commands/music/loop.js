const { SlashCommandBuilder } = require("discord.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { checkVoiceChannel, requireQueue } = require("../../utils/musicChecks.js");
const { loopLabel } = require("../../utils/music.js");

const MODE_MAP = { off: 0, song: 1, queue: 2 };

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Atur mode pengulangan lagu")
        .addStringOption((o) =>
            o
                .setName("mode")
                .setDescription("Mode pengulangan")
                .setRequired(true)
                .addChoices(
                    { name: "Off", value: "off" },
                    { name: "Lagu Ini", value: "song" },
                    { name: "Semua Antrian", value: "queue" }
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

        const mode = interaction.options.getString("mode", true);
        const newMode = queue.setRepeatMode(MODE_MAP[mode]);

        await interaction.reply({ embeds: [createSuccessEmbed(`Mode loop diatur ke \`${loopLabel(newMode)}\`.`, "🔁 Loop")] });
    }
};
