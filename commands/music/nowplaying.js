const { SlashCommandBuilder } = require("discord.js");
const { requireQueue } = require("../../utils/musicChecks.js");
const { buildNowPlayingEmbed } = require("../../utils/musicPanel.js");
module.exports = {
    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Lihat player Zeechei"), category: "music",
    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (queue) return interaction.reply({
            embeds: [buildNowPlayingEmbed(queue, queue.songs[0])],
            files: [require("../../src/music/MusicAssets").visualizerAsset(queue)],
            ephemeral: true
        });
    }
};
