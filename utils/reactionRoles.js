/**
 * ============================================
 *  REACTION ROLE HELPER (v3)
 *  Emote di pesan tertentu -> otomatis dapat role.
 * ============================================
 */
const { parseEmoji } = require("discord.js");
const db = require("./database.js");

/**
 * Parse input emote dari user (unicode 😀 ATAU custom <:nama:id> / <a:nama:id>).
 * Mengembalikan null kalau formatnya tidak valid sama sekali.
 */
function parseEmojiInput(raw) {
    const trimmed = (raw || "").trim();
    if (!trimmed) return null;
    const parsed = parseEmoji(trimmed);
    if (!parsed || !parsed.name) return null;
    return {
        id: parsed.id || null,
        name: parsed.name,
        animated: !!parsed.animated,
        raw: parsed.id ? `<${parsed.animated ? "a" : ""}:${parsed.name}:${parsed.id}>` : parsed.name
    };
}

/** Format emote untuk ditampilkan di embed (mention custom emoji atau unicode langsung). */
function formatEmoji(entry) {
    return entry.emojiId ? `<${entry.emojiAnimated ? "a" : ""}:${entry.emojiName}:${entry.emojiId}>` : entry.emojiName;
}

/** Cek apakah emote dari reaction Discord cocok dengan mapping yang tersimpan. */
function emojiMatches(entry, emoji) {
    if (entry.emojiId) return emoji.id === entry.emojiId;
    return !emoji.id && emoji.name === entry.emojiName;
}

function getGuildReactionRoles(guildId) {
    return db.getGuild(guildId).reactionRoles || [];
}

function findMapping(guildId, messageId, emoji) {
    const list = getGuildReactionRoles(guildId);
    return list.find((entry) => entry.messageId === messageId && emojiMatches(entry, emoji));
}

function addMapping(guildId, mapping) {
    const guildConfig = db.getGuild(guildId);
    const list = guildConfig.reactionRoles || [];
    // Hindari duplikat: emote yang sama pada pesan yang sama akan menimpa role lama.
    const filtered = list.filter(
        (entry) => !(entry.messageId === mapping.messageId && emojiMatches(entry, {
            id: mapping.emojiId,
            name: mapping.emojiName
        }))
    );
    filtered.push(mapping);
    db.updateGuild(guildId, { reactionRoles: filtered });
    return filtered;
}

function removeMapping(guildId, messageId, emoji) {
    const guildConfig = db.getGuild(guildId);
    const list = guildConfig.reactionRoles || [];
    const before = list.length;
    const filtered = list.filter((entry) => !(entry.messageId === messageId && emojiMatches(entry, emoji)));
    db.updateGuild(guildId, { reactionRoles: filtered });
    return before !== filtered.length;
}

module.exports = {
    parseEmojiInput,
    formatEmoji,
    emojiMatches,
    getGuildReactionRoles,
    findMapping,
    addMapping,
    removeMapping
};
