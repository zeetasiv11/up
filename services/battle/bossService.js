/**
 * ============================================
 *  WORLD BOSS SERVICE
 *  1 boss aktif per-server (disimpan di guild.boss).
 *  Setiap user bisa menyerang; damage masuk leaderboard.
 *  Reward dibagi ke semua penyerang proporsional damage saat boss kalah.
 * ============================================
 */

const db = require("../../utils/database.js");
const economy = require("../economy/economyService.js");
const { NPC_MONSTERS } = require("../battle/battleEngine.js");

const BOSS_TEMPLATES = [
    { name: "Ancient Dragon", emoji: "🐉", hp: 1000000, rewardPool: 200000 },
    { name: "Titan Golem", emoji: "🗿", hp: 1500000, rewardPool: 300000 },
    { name: "Void Serpent", emoji: "🐍", hp: 800000, rewardPool: 150000 }
];

function getBoss(guildId) {
    const guild = db.getGuild(guildId);
    return guild.boss;
}

function spawnBoss(guildId) {
    const template = BOSS_TEMPLATES[Math.floor(Math.random() * BOSS_TEMPLATES.length)];
    const boss = {
        name: template.name,
        emoji: template.emoji,
        maxHp: template.hp,
        hp: template.hp,
        rewardPool: template.rewardPool,
        damageLog: {}, // userId -> total damage
        spawnedAt: Date.now()
    };
    db.updateGuild(guildId, { boss });
    return boss;
}

function attack(guildId, userId) {
    const boss = getBoss(guildId);
    if (!boss || boss.hp <= 0) {
        return { ok: false, error: "❌ Tidak ada world boss aktif di server ini. Gunakan `zboss` untuk memunculkan boss." };
    }

    const damage = 500 + Math.floor(Math.random() * 2500);
    boss.hp = Math.max(0, boss.hp - damage);
    boss.damageLog[userId] = (boss.damageLog[userId] || 0) + damage;

    let defeated = false;
    let rewards = null;

    if (boss.hp <= 0) {
        defeated = true;
        const totalDamage = Object.values(boss.damageLog).reduce((a, b) => a + b, 0);
        rewards = Object.entries(boss.damageLog).map(([uid, dmg]) => {
            const share = Math.floor((dmg / totalDamage) * boss.rewardPool);
            economy.addBalance(uid, share);
            return { userId: uid, damage: dmg, share };
        }).sort((a, b) => b.damage - a.damage);
    }

    db.updateGuild(guildId, { boss: defeated ? null : boss });
    return { ok: true, damage, boss, defeated, rewards };
}

module.exports = { getBoss, spawnBoss, attack };
