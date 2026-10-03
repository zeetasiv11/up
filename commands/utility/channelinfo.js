const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

const TYPE_NAMES = {
    [ChannelType.GuildText]: "Text Channel",
    [ChannelType.GuildVoice]: "Voice Channel",
    [ChannelType.GuildCategory]: "Category",
    [ChannelType.GuildAnnouncement]: "Announcement Channel",
    [ChannelType.GuildForum]: "Forum Channel"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("channelinfo")
        .setDescription("Lihat informasi channel ini atau channel lain")
        .addChannelOption((o) => o.setName("channel").setDescription("Channel yang ingin dilihat")),
    async execute(interaction) {
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Nama:** ${channel.name}\n` +
                        `**ID:** ${channel.id}\n` +
                        `**Tipe:** ${TYPE_NAMES[channel.type] || "Unknown"}\n` +
                        `**Dibuat:** <t:${Math.floor(channel.createdTimestamp / 1000)}:D>\n` +
                        `**Kategori:** ${channel.parent ? channel.parent.name : "Tidak ada"}`,
                    `📄 #${channel.name}`
                )
            ]
        });
    }
};
