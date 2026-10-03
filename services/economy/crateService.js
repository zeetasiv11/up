/**
 * ============================================
 *  CRATE SERVICE
 *  Weighted drop probability: coin / item / animal.
 * ============================================
 */

const db = require("../../utils/database.js");
const economy = require("./economyService.js");
const inventoryService = require("../inventory/inventoryService.js");
const animalService = require("../animals/animalService.js");
const { rollAnimalByRarity } = require("../../data/animals.js");

const CRATE_TABLES = {
    crate_basic: {
        coinRange: [200, 900],
        rarityWeights: { common: 70, uncommon: 25, rare: 5 },
        itemChance: 0.35,
        possibleItems: ["material_ore", "food_basic"]
    },
    crate_rare: {
        coinRange: [800, 2500],
        rarityWeights: { common: 40, uncommon: 35, rare: 20, epic: 5 },
        itemChance: 0.4,
        possibleItems: ["material_ore", "material_crystal", "food_premium"]
    },
    crate_epic: {
        coinRange: [2000, 6000],
        rarityWeights: { uncommon: 25, rare: 35, epic: 30, legendary: 10 },
        itemChance: 0.45,
        possibleItems: ["material_crystal", "food_premium", "booster_xp"]
    },
    crate_legendary: {
        coinRange: [8000, 20000],
        rarityWeights: { rare: 25, epic: 35, legendary: 30, mythic: 10 },
        itemChance: 0.5,
        possibleItems: ["material_crystal", "booster_xp"]
    }
};

function weightedPick(weights) {
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (const [key, w] of Object.entries(weights)) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return Object.keys(weights)[0];
}

/**
 * Buka 1 crate. Mengembalikan { ok, rewards: [{type, ...}] }
 */
function openCrate(userId, crateId) {
    const table = CRATE_TABLES[crateId];
    if (!table) return { ok: false, error: "❌ Crate ini tidak valid." };

    const rewards = [];

    const coin = table.coinRange[0] + Math.floor(Math.random() * (table.coinRange[1] - table.coinRange[0]));
    economy.addBalance(userId, coin);
    rewards.push({ type: "coin", amount: coin });

    const rarity = weightedPick(table.rarityWeights);
    const animalTemplate = rollAnimalByRarity(rarity);
    const animalInstance = animalService.addAnimal(userId, animalTemplate.id);
    rewards.push({ type: "animal", name: animalTemplate.name, emoji: animalTemplate.emoji, rarity });

    if (Math.random() < table.itemChance) {
        const itemId = table.possibleItems[Math.floor(Math.random() * table.possibleItems.length)];
        inventoryService.addItem(userId, itemId, 1);
        rewards.push({ type: "item", itemId });
    }

    const user = db.getUser(userId);
    const stats = user.stats || { huntCount: 0, cratesOpened: 0 };
    stats.cratesOpened = (stats.cratesOpened || 0) + 1;
    db.updateUser(userId, { stats });

    return { ok: true, rewards, animalInstance };
}

module.exports = { openCrate, CRATE_TABLES };
