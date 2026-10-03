const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Lihat informasi sebuah role")
        .addRoleOption((o) => o.setName("role").setDescription("Role yang ingin dilihat").setRequired(true)),
    async execute(interaction) {
        const role = interaction.options.getRole("role");
        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Nama:** ${role.name}\n` +
                        `**ID:** ${role.id}\n` +
                        `**Warna:** ${role.hexColor}\n` +
                        `**Posisi:** ${role.position}\n` +
                        `**Jumlah Member:** ${role.members.size}\n` +
                        `**Dibuat:** <t:${Math.floor(role.createdTimestamp / 1000)}:D>\n` +
                        `**Mentionable:** ${role.mentionable ? "Ya" : "Tidak"}`,
                    `🎭 ${role.name}`
                ).setColor(role.color || 5793266)
            ]
        });
    }
};
