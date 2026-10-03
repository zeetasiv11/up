/**
 * ============================================
 *  SHOP / ITEM DATA (ORIGINAL)
 * ============================================
 */

const ITEMS = [
    { id: "crate_basic", name: "Basic Crate", emoji: "🎁", category: "Crate", price: 500, description: "Berisi coin & item dasar." },
    { id: "crate_rare", name: "Rare Crate", emoji: "🎁", category: "Crate", price: 2500, description: "Peluang lebih tinggi mendapat item/animal langka." },
    { id: "crate_epic", name: "Epic Crate", emoji: "🎁", category: "Crate", price: 10000, description: "Peluang bagus untuk animal Epic/Legendary." },
    { id: "crate_legendary", name: "Legendary Crate", emoji: "🎁", category: "Crate", price: 50000, description: "Peluang terbaik untuk animal Legendary/Mythic." },

    { id: "potion_luck", name: "Lucky Potion", emoji: "🍀", category: "Potion", price: 1200, description: "Meningkatkan peluang hunt & crate untuk 1x pakai (kosmetik/flavor)." },
    { id: "food_basic", name: "Pet Food", emoji: "🍖", category: "Food", price: 150, description: "Beri makan pet untuk menambah XP." },
    { id: "food_premium", name: "Premium Feast", emoji: "🍗", category: "Food", price: 600, description: "Pet food premium, XP lebih besar." },

    { id: "weapon_sword", name: "Iron Sword", emoji: "🗡️", category: "Weapon", price: 3000, description: "Senjata dasar untuk battle.", damage: 15 },
    { id: "weapon_bow", name: "Hunter's Bow", emoji: "🏹", category: "Weapon", price: 3500, description: "Senjata jarak jauh untuk battle.", damage: 17 },
    { id: "weapon_staff", name: "Arcane Staff", emoji: "🪄", category: "Weapon", price: 4200, description: "Senjata sihir untuk battle.", damage: 20 },

    { id: "material_ore", name: "Iron Ore", emoji: "⛏️", category: "Material", price: 80, description: "Material dasar crafting/upgrade." },
    { id: "material_crystal", name: "Mystic Crystal", emoji: "💎", category: "Material", price: 900, description: "Material langka untuk upgrade weapon." },

    { id: "collectible_medal", name: "Bronze Medal", emoji: "🥉", category: "Collectible", price: 0, description: "Diperoleh dari quest/achievement." },
    { id: "booster_xp", name: "XP Booster", emoji: "⚡", category: "Booster", price: 2000, description: "Flavor item penambah semangat grind." }
];

function getItem(id) {
    return ITEMS.find((i) => i.id === id) || null;
}

function findByNameOrId(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    return (
        ITEMS.find((i) => i.id.toLowerCase() === q) ||
        ITEMS.find((i) => i.name.toLowerCase() === q) ||
        ITEMS.find((i) => i.name.toLowerCase().includes(q)) ||
        null
    );
}

module.exports = { ITEMS, getItem, findByNameOrId };
