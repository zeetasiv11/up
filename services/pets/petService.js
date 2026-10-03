/**
 * ============================================
 *  PET SERVICE
 *  Pet = animal yang "diadopsi" dari koleksi zanimals.
 *  Bisa diberi makan (XP) dan di-equip sebagai active pet untuk zbattle.
 * ============================================
 */

const db = require("../../utils/database.js");
const animalService = require("../animals/animalService.js");
const inventoryService = require("../inventory/inventoryService.js");

const XP_PER_LEVEL = 100;
const FOOD_XP = { food_basic: 40, food_premium: 120 };

function getPets(userId) {
    const user = db.getUser(userId);
    return user.pets || [];
}

function adopt(userId, animalInstanceId, name) {
    const animals = animalService.getAnimals(userId);
    const animal = animals.find((a) => a.instanceId === animalInstanceId);
    if (!animal) return { ok: false, error: "❌ Animal dengan ID tersebut tidak ditemukan di koleksimu." };

    const pets = getPets(userId);
    if (pets.length >= 6) return { ok: false, error: "❌ Slot pet penuh (maksimal 6). Lepas salah satu pet dulu." };

    const remaining = animals.filter((a) => a.instanceId !== animalInstanceId);
    const pet = {
        instanceId: `pet_${animal.instanceId}`,
        animalId: animal.animalId,
        name: name || animalService.computeStats(animal)?.name || animal.animalId,
        level: animal.level,
        xp: animal.xp
    };
    pets.push(pet);

    db.updateUser(userId, { animals: remaining, pets });
    return { ok: true, pet };
}

function release(userId, petInstanceId) {
    const pets = getPets(userId);
    const idx = pets.findIndex((p) => p.instanceId === petInstanceId);
    if (idx === -1) return false;
    pets.splice(idx, 1);
    const user = db.getUser(userId);
    const activePetId = user.activePetId === petInstanceId ? "" : user.activePetId;
    db.updateUser(userId, { pets, activePetId });
    return true;
}

function equip(userId, petInstanceId) {
    const pets = getPets(userId);
    if (!pets.some((p) => p.instanceId === petInstanceId)) {
        return { ok: false, error: "❌ Pet tidak ditemukan." };
    }
    db.updateUser(userId, { activePetId: petInstanceId });
    return { ok: true };
}

function getActivePet(userId) {
    const user = db.getUser(userId);
    const pets = user.pets || [];
    if (user.activePetId) {
        const found = pets.find((p) => p.instanceId === user.activePetId);
        if (found) return found;
    }
    return pets[0] || null;
}

function feed(userId, petInstanceId, itemId) {
    const xpGain = FOOD_XP[itemId];
    if (!xpGain) return { ok: false, error: "❌ Item ini bukan makanan pet." };
    if (!inventoryService.hasItem(userId, itemId, 1)) {
        return { ok: false, error: "❌ Kamu tidak punya item ini di inventory." };
    }

    const pets = getPets(userId);
    const pet = pets.find((p) => p.instanceId === petInstanceId);
    if (!pet) return { ok: false, error: "❌ Pet tidak ditemukan." };

    inventoryService.removeItem(userId, itemId, 1);
    pet.xp += xpGain;
    let leveledUp = false;
    while (pet.xp >= XP_PER_LEVEL) {
        pet.xp -= XP_PER_LEVEL;
        pet.level += 1;
        leveledUp = true;
    }
    db.updateUser(userId, { pets });
    return { ok: true, pet, leveledUp };
}

/**
 * Ambil "combatant" terbaik user untuk battle: active pet, atau fallback
 * animal terkuat di koleksi (dihitung dari total stat).
 */
function getBestCombatant(userId) {
    const activePet = getActivePet(userId);
    if (activePet) {
        const stats = animalService.computeStats(activePet);
        if (stats) return { source: "pet", instance: activePet, stats };
    }

    const animals = animalService.getAnimals(userId);
    if (animals.length === 0) return null;

    let best = null;
    let bestScore = -1;
    for (const a of animals) {
        const stats = animalService.computeStats(a);
        if (!stats) continue;
        const score = stats.hp + stats.atk * 2 + stats.def + stats.spd;
        if (score > bestScore) {
            bestScore = score;
            best = { source: "animal", instance: a, stats };
        }
    }
    return best;
}

module.exports = { getPets, adopt, release, equip, getActivePet, feed, getBestCombatant, FOOD_XP };
