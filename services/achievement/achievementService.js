/**
 * ============================================
 *  ACHIEVEMENT SERVICE
 *  Status unlocked dihitung dinamis dari data user (bukan flag manual)
 *  supaya selalu akurat. achievementsClaimed dipakai supaya reward
 *  coin cuma diberikan sekali per achievement.
 * ============================================
 */

const db = require("../../utils/database.js");
const economy = require("../economy/economyService.js");

const ACHIEVEMENTS = [
    { id: "first_game", label: "🎯 First Game", desc: "Mainkan 1 game apapun", reward: 200, check: (u) => (u.gambling?.gamesPlayed || 0) >= 1 },
    { id: "first_win", label: "🏆 First Win", desc: "Menangkan 1 game apapun", reward: 300, check: (u) => (u.gambling?.wins || 0) >= 1 },
    { id: "rich", label: "💰 Rich", desc: "Miliki 100,000 coin (cash+bank)", reward: 1000, check: (u) => (u.balance || 0) + (u.bank || 0) >= 100000 },
    { id: "collector", label: "🐾 Collector", desc: "Kumpulkan 10 animal", reward: 800, check: (u) => (u.animals || []).length >= 10 },
    { id: "legendary_hunter", label: "🐉 Legendary Hunter", desc: "Tangkap 1 animal Legendary/Mythic", reward: 2500, check: (u) => (u.animals || []).some((a) => a.rarity === "legendary" || a.rarity === "mythic") },
    { id: "battle_master", label: "⚔️ Battle Master", desc: "Menangkan 5 battle", reward: 1500, check: (u) => (u.battle?.wins || 0) >= 5 },
    { id: "daily_streak", label: "🔥 Daily Streak", desc: "Capai daily streak 7 hari", reward: 1200, check: (u) => (u.dailyStreak || 0) >= 7 },
    { id: "lucky_player", label: "🎰 Lucky Player", desc: "Menangkan 20 game judi", reward: 2000, check: (u) => (u.gambling?.wins || 0) >= 20 }
];

function computeStatus(userId) {
    const user = db.getUser(userId);
    const claimed = user.achievementsClaimed || [];
    return ACHIEVEMENTS.map((a) => ({
        ...a,
        unlocked: !!a.check(user),
        claimed: claimed.includes(a.id)
    }));
}

function claim(userId, achievementId) {
    const status = computeStatus(userId);
    const ach = status.find((a) => a.id === achievementId);
    if (!ach) return { ok: false, error: "❌ Achievement tidak ditemukan." };
    if (!ach.unlocked) return { ok: false, error: "❌ Kamu belum membuka achievement ini." };
    if (ach.claimed) return { ok: false, error: "❌ Reward achievement ini sudah diklaim." };

    const user = db.getUser(userId);
    const claimed = user.achievementsClaimed || [];
    claimed.push(achievementId);
    db.updateUser(userId, { achievementsClaimed: claimed });
    economy.addBalance(userId, ach.reward);
    return { ok: true, reward: ach.reward };
}

module.exports = { ACHIEVEMENTS, computeStatus, claim };
