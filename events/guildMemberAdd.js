const { AttachmentBuilder } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createInfoEmbed, createErrorEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");
const { generateCard } = require("../utils/welcomeCard.js");

// Menyimpan timestamp join per-guild untuk deteksi anti-raid sederhana
const joinTimestamps = new Map();

async function handleAutoRole(member) {
    const guildConfig = db.getGuild(member.guild.id);
    if (!settings.autoRole.enabled && !guildConfig.autoRole) return;
    const roleId = guildConfig.autoRole || settings.autoRole.roleId;
    if (!roleId) return;

    try {
        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
            logger.warn(`Auto-role: role ${roleId} tidak ditemukan di guild ${member.guild.id}`);
            return;
        }
        await member.roles.add(role);
    } catch (err) {
        // Jangan pernah crash — cukup log error (permission kurang, dsb.)
        logger.error(`Gagal memberikan auto-role: ${err.message}`);
        await logger.sendLog(
            member.client,
            member.guild.id,
            createErrorEmbed(`Gagal memberikan auto-role ke ${member}: ${err.message}`)
        );
    }
}

async function handleAntiRaid(member) {
    if (!settings.antiRaid.enabled) return;
    const guildId = member.guild.id;
    const now = Date.now();

    if (!joinTimestamps.has(guildId)) joinTimestamps.set(guildId, []);
    const timestamps = joinTimestamps.get(guildId).filter(
        (t) => now - t < settings.antiRaid.intervalSeconds * 1000
    );
    timestamps.push(now);
    joinTimestamps.set(guildId, timestamps);

    if (timestamps.length >= settings.antiRaid.joinThreshold) {
        joinTimestamps.set(guildId, []); // reset supaya tidak spam alert berulang-ulang
        const alertChannelId = settings.antiRaid.alertChannelId || db.getGuild(guildId).logChannel;
        if (alertChannelId) {
            const channel = await member.guild.channels.fetch(alertChannelId).catch(() => null);
            if (channel) {
                await channel.send({
                    embeds: [
                        createErrorEmbed(
                            `Terdeteksi ${timestamps.length} member join dalam ${settings.antiRaid.intervalSeconds} detik.\n` +
                                `Moderator dapat mengaktifkan lockdown server jika diperlukan menggunakan \`/lock\`.`,
                            "🚨 POSSIBLE RAID DETECTED"
                        )
                    ]
                });
            }
        }
    }
}

module.exports = {
    name: "guildMemberAdd",
    once: false,
    async execute(member) {
        try {
            await require("../src/services/welcome/greetingService").sendGreeting(member, "welcome");
            await handleAutoRole(member);
            await handleAntiRaid(member);
            await require("../src/services/automod/AutoMod").handleJoin(member);
            await logger.sendLog(
                member.client,
                member.guild.id,
                createInfoEmbed(`${member} (${member.user.tag}) bergabung ke server.`, "📥 Member Join")
            );
        } catch (err) {
            logger.error(`guildMemberAdd error: ${err.message}`);
        }
    }
};
