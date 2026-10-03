const guards = new Map();
async function startGuard(guild, channelId, textChannelId) {
    const music = guild.client.music;
    if (!music) throw new Error("Music service belum tersedia.");
    const channel = await guild.channels.fetch(channelId);
    const textChannel = textChannelId ? await guild.channels.fetch(textChannelId) : null;
    const queue = await music.run(guild.id, () => music.connect(channel, textChannel));
    guards.set(guild.id, { guild, channelId, textChannelId, connection: queue.player });
    return queue.player;
}
async function stopGuard(guildId) {
    const state = guards.get(guildId);
    if (!state) return false;
    clearTimeout(state.timer);
    guards.delete(guildId);
    await state.guild.client.music?.leave(guildId);
    return true;
}
function scheduleReconnect(guild) {
    const state = guards.get(guild.id);
    const music = guild.client.music;
    if (!state || state.reconnecting || music?.closing) return;
    clearTimeout(state.timer);
    state.attempt = (state.attempt || 0) + 1;
    state.timer = setTimeout(
        async () => {
            if (!guards.has(guild.id) || music.closing) return;
            state.reconnecting = true;
            let retry = false;
            try {
                await music.run(guild.id, async () => {
                    const old = music.getQueue(guild.id);
                    const songs = old ? [...old.songs] : [];
                    const position = old?.currentTime || 0;
                    const paused = old?.paused;
                    await music.disconnect(guild.id);
                    const voice = await guild.channels.fetch(state.channelId);
                    const text = state.textChannelId ? await guild.channels.fetch(state.textChannelId) : null;
                    const queue = await music.connect(voice, text);
                    queue.songs = songs;
                    if (old) {
                        queue.repeatMode = old.repeatMode;
                        queue.autoplay = old.autoplay;
                        queue.volume = old.volume;
                    }
                    await queue.player.setGlobalVolume(queue.volume);
                    if (songs.length) {
                        await queue.start();
                        if (!songs[0].isLive)
                            await queue.player.seekTo(Math.min(position, songs[0].duration) * 1000);
                        if (paused) await queue.player.setPaused(true);
                    }
                    state.connection = queue.player;
                    state.attempt = 0;
                });
            } catch (error) {
                require("./logger.js").warn(`Voice guard reconnect failed: ${error.message}`);
                retry = true;
            } finally {
                state.reconnecting = false;
                if (retry) scheduleReconnect(guild);
            }
        },
        Math.min(60000, state.attempt * 5000),
    );
    state.timer.unref();
}
module.exports = {
    startGuard,
    stopGuard,
    scheduleReconnect,
    isGuarded: (id) => guards.has(id),
    getGuard: (id) => guards.get(id) || null,
};
