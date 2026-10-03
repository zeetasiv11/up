const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds");
module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("voicedebug")
        .setDescription("Diagnostik koneksi Lavalink dan izin voice tanpa mengganggu player"),
    async execute(interaction) {
        const music = interaction.client.music,
            node = music?.lavalink.getIdealNode(),
            queue = music?.getQueue(interaction.guildId);
        const voice = interaction.member.voice?.channel,
            permissions = voice?.permissionsFor(interaction.guild.members.me);
        const info = node?.info;
        const embed = createInfoEmbed(
            [
                `**Lavalink:** ${node ? "Connected" : "Unavailable"}`,
                `**Version:** ${info?.version?.semver || "Unknown"}`,
                `**Sources:** ${(info?.sourceManagers || []).join(", ") || "None advertised"}`,
                `**Filters:** ${(info?.filters || []).join(", ") || "None advertised"}`,
                `**Player:** ${queue?.songs.length ? (queue.paused ? "Paused" : "Playing") : "Idle"}`,
                `**Voice:** ${voice ? `<#${voice.id}>` : "Join a voice channel to check permissions"}`,
                `**Connect / Speak:** ${permissions?.has(["Connect", "Speak"]) ? "Allowed" : "Unavailable"}`,
            ].join("\n"),
            "Voice diagnostics",
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
