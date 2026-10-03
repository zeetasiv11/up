/**
 * ============================================
 *  ANIMAL DATA (ORIGINAL — bukan milik OwO)
 *  Dipakai oleh zhunt / zanimals / zzoo / zpets
 * ============================================
 */

const RARITY = {
    common: { label: "Common", emoji: "⚪", weight: 55, valueMult: 1 },
    uncommon: { label: "Uncommon", emoji: "🟢", weight: 25, valueMult: 2 },
    rare: { label: "Rare", emoji: "🔵", weight: 12, valueMult: 5 },
    epic: { label: "Epic", emoji: "🟣", weight: 6, valueMult: 12 },
    legendary: { label: "Legendary", emoji: "🟠", weight: 1.7, valueMult: 30 },
    mythic: { label: "Mythic", emoji: "🔴", weight: 0.3, valueMult: 75 }
};

const ANIMALS = [
    { id: "sparrow", name: "Sparrow", emoji: "🐦", rarity: "common", baseValue: 40, baseAtk: 4, baseDef: 2, baseHp: 20, baseSpd: 8 },
    { id: "rabbit", name: "Rabbit", emoji: "🐇", rarity: "common", baseValue: 45, baseAtk: 3, baseDef: 3, baseHp: 22, baseSpd: 9 },
    { id: "fox", name: "Fox", emoji: "🦊", rarity: "uncommon", baseValue: 120, baseAtk: 8, baseDef: 5, baseHp: 35, baseSpd: 10 },
    { id: "wolf", name: "Shadow Wolf", emoji: "🐺", rarity: "uncommon", baseValue: 140, baseAtk: 10, baseDef: 6, baseHp: 40, baseSpd: 9 },
    { id: "boar", name: "Wild Boar", emoji: "🐗", rarity: "uncommon", baseValue: 130, baseAtk: 9, baseDef: 8, baseHp: 45, baseSpd: 5 },
    { id: "eagle", name: "Golden Eagle", emoji: "🦅", rarity: "rare", baseValue: 350, baseAtk: 16, baseDef: 9, baseHp: 55, baseSpd: 14 },
    { id: "panther", name: "Black Panther", emoji: "🐆", rarity: "rare", baseValue: 380, baseAtk: 18, baseDef: 10, baseHp: 58, baseSpd: 15 },
    { id: "bear", name: "Grizzly Bear", emoji: "🐻", rarity: "rare", baseValue: 360, baseAtk: 17, baseDef: 14, baseHp: 80, baseSpd: 6 },
    { id: "griffin", name: "Griffin", emoji: "🦁", rarity: "epic", baseValue: 900, baseAtk: 28, baseDef: 18, baseHp: 110, baseSpd: 16 },
    { id: "kraken", name: "Baby Kraken", emoji: "🐙", rarity: "epic", baseValue: 950, baseAtk: 30, baseDef: 16, baseHp: 120, baseSpd: 10 },
    { id: "phoenix", name: "Phoenix", emoji: "🔥", rarity: "legendary", baseValue: 2400, baseAtk: 45, baseDef: 25, baseHp: 160, baseSpd: 22 },
    { id: "dragon", name: "Ancient Dragon", emoji: "🐉", rarity: "legendary", baseValue: 2600, baseAtk: 50, baseDef: 30, baseHp: 180, baseSpd: 18 },
    { id: "voidwyrm", name: "Voidwyrm", emoji: "🌌", rarity: "mythic", baseValue: 8000, baseAtk: 80, baseDef: 45, baseHp: 260, baseSpd: 26 }
];

const HUNT_LOCATIONS = ["🌲 hutan pinus", "🏔️ pegunungan berkabut", "🏝️ pantai terpencil", "🕳️ gua gelap", "🌾 padang rumput luas", "🌋 lereng gunung berapi"];

function getAnimal(id) {
    return ANIMALS.find((a) => a.id === id) || null;
}

function rollRarity() {
    const totalWeight = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const [key, r] of Object.entries(RARITY)) {
        roll -= r.weight;
        if (roll <= 0) return key;
    }
    return "common";
}

function rollAnimalByRarity(rarity) {
    const pool = ANIMALS.filter((a) => a.rarity === rarity);
    if (pool.length === 0) return ANIMALS[0];
    return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { ANIMALS, RARITY, HUNT_LOCATIONS, getAnimal, rollRarity, rollAnimalByRarity };
