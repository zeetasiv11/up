const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder().setName("serverinfo").setDescription("Lihat informasi server ini"),
    async execute(interaction) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner().catch(() => null);

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Nama:** ${guild.name}\n` +
                        `**Owner:** ${owner ? owner.user.tag : "Tidak diketahui"}\n` +
                        `**Member:** ${guild.memberCount}\n` +
                        `**Role:** ${guild.roles.cache.size}\n` +
                        `**Channel:** ${guild.channels.cache.size}\n` +
                        `**Boost Level:** ${guild.premiumTier}\n` +
                        `**Dibuat:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
                    `🏰 ${guild.name}`
                ).setThumbnail(guild.iconURL({ dynamic: true }))
            ]
        });
    }
};
