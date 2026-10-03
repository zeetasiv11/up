const settings = require("../settings.js");
const logger = require("./logger.js");
const db = require("./database.js");
const { createLavalink } = require("../src/music/LavalinkManager.js");
const { MusicManager } = require("../src/music/MusicManager.js");
const { MusicPanelUpdater } = require("../src/music/MusicPanelUpdater.js");
const { recordHistory } = require("./musicFeatures.js");
const format = require("./musicFormat.js");
function is247Enabled(guildId) {
    return Boolean(guildId && db.getGuild(guildId).musicMode247);
}
function setupMusic(client) {
    if (!settings.music.enabled) return null;
    const panels = new MusicPanelUpdater(client, db, logger);
    const music = new MusicManager({
        client,
        lavalink: createLavalink(client, logger),
        panels,
        settings,
        repository: db,
        history: recordHistory,
        logger,
    });
    music.lavalink.on("ready", (name) => {
        void restoreNode(music, name, client, db, logger).catch((error) =>
            logger.warn("[PLAYER] Node restoration failed"),
        );
    });
    music.lavalink.on("close", (name) => music.nodeUnavailable(name));
    music.lavalink.on("voiceUpdateFailed", (guildId) => music.handleVoiceDisconnect(guildId));
    client.music = music;
    require("./voiceGuard.js").bindMusic(music);
    // Compatibility facade for existing command modules; no DisTube engine remains.
    client.distube = music;
    client.on("guildDelete", (guild) => {
        void Promise.resolve()
            .then(() => music.leave(guild.id))
            .catch(() => logger.warn("[VOICE] Guild cleanup failed"));
        panels.forget(guild.id);
    });
    client.on("messageDelete", (message) => {
        if (panels.panels.get(message.guildId)?.id === message.id) panels.forget(message.guildId);
    });
    client.on("voiceStateUpdate", (oldState, nextState) => {
        if (music.closing) return;
        try {
            const guildId = nextState.guild.id;
            if (nextState.id === client.user?.id) {
                if (oldState.channelId && !nextState.channelId) music.handleVoiceDisconnect(guildId);
                else if (nextState.channelId) {
                    const queue = music.getQueue(guildId);
                    if (queue && nextState.channel) {
                        queue.voiceChannel = nextState.channel;
                        queue.voice.channel = nextState.channel;
                        void music.notify(queue).catch(() => {});
                    }
                }
            }
            music.checkEmpty(guildId);
        } catch {
            logger.warn("[VOICE] Voice state handling failed");
        }
    });
    return music;
}
async function restoreNode(music, name, client, db, logger) {
    const node = music.lavalink.nodes.get(name);
    if (!node || music.closing) return;
    try {
        node.info = await node.rest.getLavalinkInfo();
    } catch (error) {
        logger.warn("[LAVALINK] Capabilities unavailable", {
            status: Number.isInteger(error.status) ? error.status : "unavailable",
            code: error.code || error.name,
        });
    }
    if (music.closing) return;
    if (music.reconcileNode) await music.reconcileNode();
    else await music.restorePlayers();
}
module.exports = { setupMusic, restoreNode, ...format, is247Enabled };
