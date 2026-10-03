const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { baseEmbed } = require("../../utils/embeds.js");
const { collectSystemInfo, formatBytes, formatDuration } = require("../../utils/systemInfo.js");
const { generateStatsCard } = require("../../utils/botStatsCard.js");

module.exports = {
    data: new SlashCommandBuilder().setName("botinfo").setDescription("Lihat informasi lengkap bot & spesifikasi server"),
    async execute(interaction) {
        await interaction.deferReply(); // sampling CPU butuh ~250ms + generate gambar, hindari "interaction failed"

        const client = interaction.client;
        const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const botUptimeMs = Date.now() - (client.startedAt || Date.now());
        const database = db.getDB();

        const info = await collectSystemInfo(client);
        const botUptimeText = formatDuration(botUptimeMs / 1000);
        const osUptimeText = formatDuration(info.os.uptimeSeconds);

        const embed = baseEmbed(settings.colors.primary)
            .setTitle(`🤖 ${settings.botName} — Informasi & Spesifikasi Server`)
            .addFields(
                {
                    name: "📊 Bot",
                    value:
                        `**Ping:** ${Math.round(client.ws.ping)}ms\n` +
                        `**Servers:** ${client.guilds.cache.size}\n` +
                        `**Users:** ${userCount.toLocaleString("id-ID")}\n` +
                        `**Commands:** ${client.commands.size}\n` +
                        `**Commands Used:** ${(database.stats.commandsUsed || 0).toLocaleString("id-ID")}\n` +
                        `**Bot Uptime:** ${botUptimeText}`,
                    inline: true
                },
                {
                    name: "🖥️ CPU",
                    value:
                        `**Model:** ${info.cpu.model}\n` +
                        `**Cores:** ${info.cpu.cores}\n` +
                        `**Clock:** ${info.cpu.speedMHz ? `${(info.cpu.speedMHz / 1000).toFixed(2)} GHz` : "?"}\n` +
                        `**Usage:** ${info.cpu.usagePercent}%`,
                    inline: true
                },
                {
                    name: "🧠 RAM",
                    value:
                        `**Total:** ${formatBytes(info.memory.total)}\n` +
                        `**Terpakai:** ${formatBytes(info.memory.used)} (${info.memory.percent}%)\n` +
                        `**Tersisa:** ${formatBytes(info.memory.free)}\n` +
                        `**Proses Bot:** ${formatBytes(info.process.rss)}`,
                    inline: true
                },
                {
                    name: "💾 Disk",
                    value: info.disk.available
                        ? `**Total:** ${formatBytes(info.disk.total)}\n**Terpakai:** ${formatBytes(info.disk.used)} (${info.disk.percent}%)\n**Tersisa:** ${formatBytes(info.disk.free)}`
                        : "_Tidak tersedia di sistem ini._",
                    inline: true
                },
                {
                    name: "🗄️ Server / OS",
                    value:
                        `**OS:** ${info.os.type} (${info.os.release})\n` +
                        `**Platform:** ${info.os.platform}/${info.os.arch}\n` +
                        `**Hostname:** ${info.os.hostname}\n` +
                        `**Server Uptime:** ${osUptimeText}`,
                    inline: true
                },
                {
                    name: "⚙️ Runtime",
                    value:
                        `**Node.js:** ${info.process.nodeVersion}\n` +
                        `**discord.js:** ${require("discord.js").version}\n` +
                        `**Heap Used:** ${formatBytes(info.process.heapUsed)} / ${formatBytes(info.process.heapTotal)}`,
                    inline: true
                }
            )
            .setFooter({ text: `${settings.botName} • Data diambil langsung dari server bot` })
            .setTimestamp();

        const cardBuffer = await generateStatsCard(client, info, {
            botName: settings.botName,
            ping: Math.round(client.ws.ping),
            servers: client.guilds.cache.size,
            users: userCount,
            botUptimeText,
            osUptimeText
        });

        if (cardBuffer) {
            const attachment = new AttachmentBuilder(cardBuffer, { name: "botinfo.png" });
            embed.setImage("attachment://botinfo.png");
            return interaction.editReply({ embeds: [embed], files: [attachment] });
        }

        return interaction.editReply({ embeds: [embed] });
    }
};
