/**
 * ============================================
 *  ANIMAL SERVICE
 *  Hunting encounters + koleksi animal milik user.
 *  Dipakai oleh zhunt, zanimals/zzoo, zpets, zbattle.
 * ============================================
 */

const db = require("../../utils/database.js");
const { ANIMALS, rollRarity, rollAnimalByRarity, getAnimal } = require("../../data/animals.js");

function getAnimals(userId) {
    const user = db.getUser(userId);
    return user.animals || [];
}

function addAnimal(userId, animalId) {
    const template = getAnimal(animalId);
    if (!template) return null;

    const animals = getAnimals(userId);
    const instance = {
        instanceId: `${animalId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        animalId,
        rarity: template.rarity,
        level: 1,
        xp: 0,
        caughtAt: Date.now()
    };
    animals.push(instance);
    db.updateUser(userId, { animals });
    return instance;
}

function removeAnimal(userId, instanceId) {
    const animals = getAnimals(userId);
    const idx = animals.findIndex((a) => a.instanceId === instanceId);
    if (idx === -1) return false;
    animals.splice(idx, 1);
    db.updateUser(userId, { animals });
    return true;
}

/**
 * Hitung stats efektif 1 instance animal (dipengaruhi level).
 */
function computeStats(instance) {
    const template = getAnimal(instance.animalId);
    if (!template) return null;
    const levelMult = 1 + (instance.level - 1) * 0.12;
    return {
        name: template.name,
        emoji: template.emoji,
        rarity: template.rarity,
        hp: Math.round(template.baseHp * levelMult),
        atk: Math.round(template.baseAtk * levelMult),
        def: Math.round(template.baseDef * levelMult),
        spd: Math.round(template.baseSpd * levelMult),
        value: Math.round(template.baseValue * levelMult)
    };
}

/**
 * Buat 1 encounter hunting: rarity di-roll, lalu animal spesifik dari rarity itu.
 * outcome bisa: "animal", "coin", "item", "xp", "nothing" — supaya zhunt bervariasi
 * (sesuai spec: random encounter animal/coin/item/XP/crate/nothing).
 */
function rollHuntOutcome() {
    const roll = Math.random();
    if (roll < 0.45) return { type: "animal", rarity: rollRarity() };
    if (roll < 0.65) return { type: "coin", amount: 200 + Math.floor(Math.random() * 1800) };
    if (roll < 0.8) return { type: "xp", amount: 20 + Math.floor(Math.random() * 60) };
    if (roll < 0.9) return { type: "crate" };
    return { type: "nothing" };
}

function rarityCounts(userId) {
    const animals = getAnimals(userId);
    const counts = {};
    for (const a of animals) counts[a.rarity] = (counts[a.rarity] || 0) + 1;
    return counts;
}

module.exports = {
    getAnimals,
    addAnimal,
    removeAnimal,
    computeStats,
    rollHuntOutcome,
    rollAnimalByRarity,
    rarityCounts,
    ANIMALS
};
