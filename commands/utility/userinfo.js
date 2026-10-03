const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Lihat informasi seorang user")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat")),
    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        const roles = member
            ? member.roles.cache.filter((r) => r.id !== interaction.guild.id).map((r) => `${r}`).join(", ") || "Tidak ada"
            : "Tidak diketahui";

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Username:** ${target.tag}\n` +
                        `**ID:** ${target.id}\n` +
                        `**Akun dibuat:** <t:${Math.floor(target.createdTimestamp / 1000)}:D>\n` +
                        `**Bergabung server:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "Tidak diketahui"}\n` +
                        `**Roles:** ${roles}`,
                    `👤 ${target.username}`
                ).setThumbnail(target.displayAvatarURL({ dynamic: true }))
            ]
        });
    }
};
