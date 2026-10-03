/**
 * ============================================
 *  GAMBLING STATS SERVICE
 *  Mencatat wins/losses/gamesPlayed/totalWagered
 *  per user, dipakai untuk zprofile/zleaderboard (fase berikutnya).
 * ============================================
 */

const db = require("../../utils/database.js");
const questService = require("../quest/questService.js");

const DEFAULT_STATS = { wins: 0, losses: 0, gamesPlayed: 0, totalWagered: 0 };

function getStats(userId) {
    const user = db.getUser(userId);
    return { ...DEFAULT_STATS, ...(user.gambling || {}) };
}

function recordGameResult(userId, { won, wager = 0 }) {
    const stats = getStats(userId);
    stats.gamesPlayed += 1;
    stats.totalWagered += Math.max(0, Math.floor(wager));
    if (won) stats.wins += 1;
    else stats.losses += 1;
    db.updateUser(userId, { gambling: stats });

    // Hook ke daily quest system — semua game judi (existing & baru) otomatis
    // progress quest "play_game" / "win_game" tanpa perlu edit tiap file game.
    questService.progressQuest(userId, "play_game", 1);
    if (won) questService.progressQuest(userId, "win_game", 1);

    return stats;
}

module.exports = { getStats, recordGameResult };
