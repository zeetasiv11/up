/**
 * ============================================
 *  DAILY QUEST SERVICE
 *  3 quest harian random per user, reset otomatis tiap hari (UTC date string).
 *  Progress diupdate lewat progressQuest() dari command lain (game, hunt, battle, dst).
 * ============================================
 */

const db = require("../../utils/database.js");

const QUEST_POOL = [
    { type: "play_game", label: "Mainkan game apapun", target: () => 3 + Math.floor(Math.random() * 3), reward: 800 },
    { type: "win_game", label: "Menangkan game apapun", target: () => 1 + Math.floor(Math.random() * 2), reward: 1500 },
    { type: "hunt", label: "Lakukan hunting", target: () => 2 + Math.floor(Math.random() * 3), reward: 700 },
    { type: "earn_coins", label: "Dapatkan coin dari aktivitas apapun", target: () => 3000 + Math.floor(Math.random() * 4000), reward: 1000 },
    { type: "battle", label: "Menangkan battle", target: () => 1 + Math.floor(Math.random() * 2), reward: 1800 },
    { type: "use_item", label: "Gunakan item dari inventory", target: () => 1 + Math.floor(Math.random() * 2), reward: 600 }
];

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function pickQuests() {
    const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
    return shuffled.map((q) => ({
        type: q.type,
        label: q.label,
        progress: 0,
        target: q.target(),
        reward: q.reward,
        claimed: false
    }));
}

function getQuests(userId) {
    const user = db.getUser(userId);
    const today = todayKey();
    let quests = user.quests || { date: "", list: [], rerollsUsed: 0 };

    if (quests.date !== today) {
        quests = { date: today, list: pickQuests(), rerollsUsed: 0 };
        db.updateUser(userId, { quests });
    }
    return quests;
}

function rerollQuests(userId) {
    const quests = getQuests(userId);
    if (quests.rerollsUsed >= 1) {
        return { ok: false, error: "❌ Kamu sudah reroll quest hari ini." };
    }
    quests.list = pickQuests();
    quests.rerollsUsed += 1;
    db.updateUser(userId, { quests });
    return { ok: true, quests };
}

/**
 * Tambah progress ke semua quest aktif bertipe `type` (belum claimed).
 * Aman dipanggil dari command manapun — no-op kalau tidak ada quest cocok.
 */
function progressQuest(userId, type, amount = 1) {
    const quests = getQuests(userId);
    let changed = false;
    for (const q of quests.list) {
        if (q.type === type && !q.claimed && q.progress < q.target) {
            q.progress = Math.min(q.target, q.progress + amount);
            changed = true;
        }
    }
    if (changed) db.updateUser(userId, { quests });
    return quests;
}

function claimQuest(userId, index) {
    const quests = getQuests(userId);
    const quest = quests.list[index];
    if (!quest) return { ok: false, error: "❌ Quest tidak ditemukan." };
    if (quest.claimed) return { ok: false, error: "❌ Quest ini sudah diklaim." };
    if (quest.progress < quest.target) return { ok: false, error: "❌ Quest ini belum selesai." };

    quest.claimed = true;
    db.updateUser(userId, { quests });
    return { ok: true, reward: quest.reward };
}

module.exports = { getQuests, rerollQuests, progressQuest, claimQuest };
