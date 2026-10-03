const { ActivityType } = require("discord.js");
const settings = require("../settings.js");
const logger = require("../utils/logger.js");
const { registerCommands } = require("../handlers/commandHandler.js");
const db = require("../utils/database.js");
const { startGuard } = require("../utils/voiceGuard.js");

function buildActivity(client, statusConfig) {
    const text = statusConfig.text
        .replace("{serverCount}", client.guilds.cache.size)
        .replace("{userCount}", client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0));

    const typeMap = {
        Watching: ActivityType.Watching,
        Listening: ActivityType.Listening,
        Playing: ActivityType.Playing,
        Competing: ActivityType.Competing
    };

    return { text, type: typeMap[statusConfig.type] ?? ActivityType.Playing };
}

function startStatusRotation(client) {
    if (!settings.statusRotation.enabled || settings.statusRotation.statuses.length === 0) return;

    let index = 0;
    const rotate = () => {
        const statusConfig = settings.statusRotation.statuses[index % settings.statusRotation.statuses.length];
        const { text, type } = buildActivity(client, statusConfig);
        client.user.setActivity(text, { type });
        index++;
    };

    rotate();
    setInterval(rotate, settings.statusRotation.intervalSeconds * 1000);
}

module.exports = {
    name: "clientReady",
    once: true,
    async execute(client) {
        clearInterval(client.ticketSweep);
        client.ticketSweep = setInterval(() => require("../src/services/tickets/ticketService").sweep(client).catch(error => logger.error(`Ticket sweep: ${error.message}`)), 60000);
        client.ticketSweep.unref();
        await require("../services/game/sessionManager").restore(client);
        logger.success(`${client.user.tag} sudah online.`);
        logger.info(`Melayani ${client.guilds.cache.size} server | ${client.commands.size} command dimuat.`);

        const database = db.getDB();
        if (!database.stats.startedAt) {
            database.stats.startedAt = Date.now();
            db.save();
        }
        client.startedAt = database.stats.startedAt || Date.now();

        await registerCommands(client);
        startStatusRotation(client);
        await restoreVoiceGuards(client);
        await client.distube?.restoreMusicPanels?.();
    }
};

/**
 * Setiap bot restart (crash, redeploy, dsb), guild yang punya /vcguard aktif
 * otomatis di-rejoin lagi supaya bot bisa "jaga" voice channel berhari-hari
 * tanpa perlu command manual ulang tiap kali proses node-nya restart.
 */
async function restoreVoiceGuards(client) {
    const database = db.getDB();
    for (const [guildId, guildData] of Object.entries(database.guilds || {})) {
        if (!guildData.vcGuard?.enabled || !guildData.vcGuard.channelId) continue;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        try {
            await startGuard(guild, guildData.vcGuard.channelId, guildData.vcGuard.textChannelId);
            logger.info(`[VC-GUARD] Restore guard guild ${guildId} -> channel ${guildData.vcGuard.channelId}`);
        } catch (err) {
            logger.error(`[VC-GUARD] Gagal restore guard guild ${guildId} saat startup: ${err.message}`);
        }
    }
}
