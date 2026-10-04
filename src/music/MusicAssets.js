const path = require("node:path");
const ASSET_ROOT = path.join(__dirname, "../../assets/music");
const EMOJI_KEYS = ["play", "music", "heart", "volume", "loading", "equalizer"];
const emojiName = key => `zeechei_${key}_v1`;
const initialized = new WeakMap();

/** Application-owned assets: no guild upload permission or external emoji dependency. */
function initializeMusicEmojis(client, logger) {
    if (initialized.has(client)) return initialized.get(client);
    const task = (async () => {
        const manager = client.application?.emojis;
        if (!manager) return;
        try {
            // A failed list must not lead to duplicate uploads on every restart.
            const existing = await manager.fetch();
            let ready = 0;
            for (const key of EMOJI_KEYS) {
                if (existing.some(emoji => emoji.name === emojiName(key))) { ready++; continue; }
                try {
                    await manager.create({ name: emojiName(key), attachment: path.join(ASSET_ROOT, `${key}.gif`) });
                    ready++;
                } catch (error) {
                    logger.warn(`[PANEL] Emoji ${key} unavailable (code ${error.code || "unknown"}); using fallback`);
                }
            }
            logger.info(`[PANEL] Animated music emojis ready (${ready}/${EMOJI_KEYS.length})`);
        } catch (error) {
            logger.warn(`[PANEL] Application emojis unavailable (code ${error.code || "unknown"}); using fallback`);
        }
    })();
    initialized.set(client, task);
    return task;
}
function visualizerAsset(queue) {
    const connected = !queue.player?.node || queue.player.node.state === require("shoukaku").Constants.State.CONNECTED;
    const playing = connected && !queue.paused && !queue.loading && !queue.recovering && !queue.nodeUnavailable;
    const name = playing ? "equalizer-banner.gif" : "equalizer-paused.png";
    return { name, attachment: path.join(ASSET_ROOT, name) };
}
module.exports = { initializeMusicEmojis, emojiName, visualizerAsset };
