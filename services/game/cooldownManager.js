/**
 * ============================================
 *  COOLDOWN MANAGER
 *  Cooldown terpusat per (gameKey, userId) — bukan per nama command,
 *  supaya alias command (zubj/zbj/zblackjack) tidak bisa dipakai
 *  untuk bypass cooldown yang sama.
 * ============================================
 */

const cooldowns = new Map();
let nextSweep = 0;

/**
 * Cek + set cooldown sekaligus.
 * @returns {number} 0 jika boleh jalan (cooldown baru saja di-set),
 *                    atau sisa detik jika masih cooldown.
 */
function checkCooldown(gameKey, userId, cooldownMs) {
    const key = `${gameKey}:${userId}`;
    const now = Date.now();
    const expiry = cooldowns.get(key);

    if (expiry && now < expiry) {
        return Math.ceil((expiry - now) / 1000);
    }

    if (now >= nextSweep) {
        for (const [entry, expires] of cooldowns) if (expires <= now) cooldowns.delete(entry);
        nextSweep = now + 60000;
    }
    cooldowns.set(key, now + cooldownMs);
    return 0;
}

function clearCooldown(gameKey, userId) {
    cooldowns.delete(`${gameKey}:${userId}`);
}

module.exports = { checkCooldown, clearCooldown };
