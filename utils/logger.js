const settings = require("../settings.js");
const { getGuild } = require("./database.js");

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
function redact(value) {
    let text = String(value);
    for (const key of [
        "DISCORD_TOKEN",
        "SUPABASE_SERVICE_ROLE_KEY",
        "LAVALINK_PASSWORD",
        "SESSION_SECRET",
        "DISCORD_CLIENT_SECRET",
    ])
        if (process.env[key]) text = text.split(process.env[key]).join("[REDACTED]");
    return text.replace(/Bearer\s+[A-Za-z0-9._~-]+/g, "Bearer [REDACTED]");
}
function write(level, message, metadata = {}) {
    if (levels[level] < (levels[process.env.LOG_LEVEL] || 20)) return;
    const safe = Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
            key,
            /token|secret|password|authorization|cookie/i.test(key)
                ? "[REDACTED]"
                : redact(typeof value === "object" ? JSON.stringify(value) : value),
        ]),
    );
    const record = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        service: "bot",
        ...safe,
        message: redact(message),
    };
    (level === "error" ? console.error : console.log)(JSON.stringify(record));
}
const info = (message, metadata) => write("info", message, metadata);
const warn = (message, metadata) => write("warn", message, metadata);
const error = (message, metadata) => write("error", message, metadata);
const debug = (message, metadata) => write("debug", message, metadata);
const game = (message) => info(message, { service: "game" });
const economy = (message) => info(message, { service: "economy" });
const success = info;

/**
 * Kirim embed log ke log channel guild (jika dikonfigurasi),
 * fallback ke global settings.logs.channelId.
 * Tidak pernah throw — kegagalan kirim log tidak boleh membuat bot crash.
 */
async function sendLog(client, guildId, embed) {
    try {
        if (!settings.logs.enabled) return;
        let channelId = settings.logs.channelId;
        if (guildId) {
            const guildConfig = getGuild(guildId);
            if (guildConfig.logChannel) channelId = guildConfig.logChannel;
        }
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;
        await channel.send({ embeds: [embed] }).catch((err) => {
            warn(`Gagal mengirim log ke channel ${channelId}: ${err.message}`);
        });
    } catch (err) {
        error(`sendLog error: ${err.message}`);
    }
}

module.exports = { info, warn, error, debug, game, economy, success, sendLog };
