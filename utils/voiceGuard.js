// Compatibility facade. The bot has one music manager and this utility owns no players/timers.
let music;
function bindMusic(manager) {
    music = manager;
}
async function startGuard(guild, channelId, textChannelId) {
    const manager = guild.client.music;
    if (!manager) throw new Error("Music service belum tersedia.");
    bindMusic(manager);
    return manager.startGuard(guild, channelId, textChannelId);
}
function stopGuard(guildId) {
    return music ? music.stopGuard(guildId) : Promise.resolve(false);
}
function isGuarded(guildId) {
    return Boolean(music?.repository.getGuild(guildId).vcGuard?.enabled);
}
function getGuard(guildId) {
    if (!isGuarded(guildId)) return null;
    return {
        ...music.repository.getGuild(guildId).vcGuard,
        guild: music.client.guilds.cache.get(guildId),
        connection: music.getQueue(guildId)?.player,
    };
}
function scheduleReconnect(guild) {
    guild.client.music?.handleVoiceDisconnect(guild.id);
}
module.exports = { bindMusic, startGuard, stopGuard, scheduleReconnect, isGuarded, getGuard };
