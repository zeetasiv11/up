const FALLBACKS = Object.freeze({
    play: "▶️",
    pause: "⏸️",
    next: "⏭️",
    previous: "⏮️",
    stop: "⏹️",
    queue: "📑",
    loop: "🔁",
    shuffle: "🔀",
    volume: "🔊",
    music: "♫",
    loading: "⌛",
    equalizer: "♫",
    heart: "🤍",
});
class MusicEmojiManager {
    constructor({ guild, channel, env = process.env, overrides = {} } = {}) {
        this.guild = guild;
        this.channel = channel;
        this.env = env;
        this.overrides = overrides;
    }
    get(key) {
        const fallback = FALLBACKS[key] || FALLBACKS.music;
        const configured = this.overrides[key] || this.env[`MUSIC_EMOJI_${key.toUpperCase()}`] || "";
        const match = /^<a?:[a-zA-Z0-9_]+:(\d{17,20})>$/.exec(configured);
        const appEmojis = this.guild?.client?.application?.emojis?.cache;
        const member = this.guild?.members?.me;
        const usable = emoji => {
            if (!emoji || emoji.available === false) return false;
            if (appEmojis?.get(emoji.id) === emoji) return true;
            if (emoji.guild?.id !== this.guild?.id &&
                !this.channel?.permissionsFor?.(member)?.has("UseExternalEmojis")) return false;
            return !emoji.roles?.cache?.size || emoji.roles.cache.some(role => member?.roles?.cache?.has(role.id));
        };
        const format = emoji => `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
        if (match) {
            const configuredEmoji = appEmojis?.get(match[1]) || this.guild?.client?.emojis?.cache?.get(match[1]);
            if (usable(configuredEmoji)) return format(configuredEmoji);
        } else if (/^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(configured)) {
            return configured;
        }
        const candidates = [...(this.guild?.emojis?.cache?.values?.() || [])].filter(emoji =>
            [`music_${key}`, key === "equalizer" ? "music_playing" : `zeechei_${key}`].includes(emoji.name)
        ).filter(usable).sort((a, b) => Number(b.animated) - Number(a.animated));
        if (candidates[0]) return format(candidates[0]);
        const managed = appEmojis?.find(emoji => emoji.name === require("./MusicAssets").emojiName(key));
        if (usable(managed)) return format(managed);
        return fallback;
    }
    getPlayEmoji() {
        return this.get("play");
    }
    getPauseEmoji() {
        return this.get("pause");
    }
    getNextEmoji() {
        return this.get("next");
    }
    getPreviousEmoji() {
        return this.get("previous");
    }
    getQueueEmoji() {
        return this.get("queue");
    }
    getLoopEmoji() {
        return this.get("loop");
    }
    getShuffleEmoji() {
        return this.get("shuffle");
    }
    getVolumeEmoji() {
        return this.get("volume");
    }
    getLoadingEmoji() {
        return this.get("loading");
    }
    getMusicEmoji() {
        return this.get("music");
    }
    getPlayingEmoji() {
        return this.get("equalizer");
    }
}
module.exports = { MusicEmojiManager, FALLBACKS };
