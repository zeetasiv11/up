const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("ownerpanel")
        .setDescription("Panel khusus owner: lihat statistik & daftar server bot")
        .addSubcommand((sub) => sub.setName("servers").setDescription("Lihat semua server yang menggunakan bot"))
        .addSubcommand((sub) => sub.setName("config").setDescription("Lihat konfigurasi global bot (settings.js)")),
    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        if (sub === "servers") {
            const guilds = [...client.guilds.cache.values()]
                .sort((a, b) => b.memberCount - a.memberCount)
                .slice(0, 25)
                .map((g) => `**${g.name}** — ${g.memberCount} member (ID: ${g.id})`)
                .join("\n");

            return interaction.reply({
                embeds: [createInfoEmbed(guilds || "Tidak ada server.", `🌐 Server List (${client.guilds.cache.size} total)`)],
                ephemeral: true
            });
        }

        if (sub === "config") {
            return interaction.reply({
                embeds: [
                    createInfoEmbed(
                        `**Bot Name:** ${settings.botName}\n` +
                            `**Prefix:** ${settings.prefix}\n` +
                            `**Owner IDs:** ${settings.ownerIds.join(", ")}\n` +
                            `**Maintenance:** ${settings.maintenance.enabled ? "Aktif" : "Nonaktif"}\n` +
                            `**Anti-Spam:** ${settings.antiSpam.enabled ? "Aktif" : "Nonaktif"}\n` +
                            `**Anti-Raid:** ${settings.antiRaid.enabled ? "Aktif" : "Nonaktif"}`,
                        "⚙️ Konfigurasi Global (settings.js)"
                    )
                ],
                ephemeral: true
            });
        }
    }
};
