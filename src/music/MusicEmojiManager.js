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
        const candidates = [];
        if (match) {
            const emoji = this.guild?.client?.emojis?.cache?.get(match[1]);
            if (emoji) candidates.push(emoji);
        }
        for (const emoji of this.guild?.emojis?.cache?.values?.() || []) {
            if (
                [`music_${key}`, key === "equalizer" ? "music_playing" : `zeechei_${key}`].includes(
                    emoji.name,
                )
            )
                candidates.push(emoji);
        }
        const member = this.guild?.members?.me;
        const usable = candidates
            .filter((emoji) => {
                if (emoji.available === false) return false;
                if (
                    emoji.guild?.id !== this.guild?.id &&
                    !this.channel?.permissionsFor?.(member)?.has("UseExternalEmojis")
                )
                    return false;
                if (
                    emoji.roles?.cache?.size &&
                    !emoji.roles.cache.some((role) => member?.roles?.cache?.has(role.id))
                )
                    return false;
                return true;
            })
            .sort((a, b) => Number(b.animated) - Number(a.animated));
        if (usable[0]) return `<${usable[0].animated ? "a" : ""}:${usable[0].name}:${usable[0].id}>`;
        if (!match && /^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(configured))
            return configured;
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
