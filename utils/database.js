const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.LEGACY_DATABASE_PATH || path.join(__dirname, "..", "database", "database.json");

const DEFAULT_DB = {
    guilds: {},
    users: {},
    blacklist: [],
    warnings: {},
    tickets: {},
    reminders: [],
    afk: {},
    stats: { commandsUsed: 0, startedAt: 0 },
    // Lottery global (virtual currency only) — direset & di-draw otomatis tiap hari.
    lottery: { date: "", pot: 0, tickets: {}, lastWinnerId: "", lastPot: 0 }
};

const DEFAULT_GUILD = {
    welcomeChannel: "",
    goodbyeChannel: "",
    autoRole: "",
    logChannel: "",
    leveling: true,
    maintenance: false,
    lockedChannels: [],
    // Konfigurasi /vcguard - dipakai buat auto-rejoin voice channel setelah bot restart.
    vcGuard: { enabled: false, channelId: "", textChannelId: "" },
    // (v3.1) /247 - kalau true, bot TIDAK auto-leave voice channel walau channel kosong
    // atau antrian musik sudah habis (kebalikan dari settings.js -> music.leaveOnEmpty/leaveOnFinish,
    // per-server & bisa di-toggle kapan saja tanpa restart bot).
    musicMode247: false,
    // Game apa saja yang dinonaktifkan khusus server ini (zgame disable <game>).
    disabledGames: [],
    // Data world boss per-server (fase RPG).
    boss: null,

    // ==== Reaction Role (v3) ====
    // Daftar mapping emote -> role per pesan.
    // Contoh isi: [{ channelId, messageId, emojiId, emojiName, emojiRaw, roleId, addedAt }]
    reactionRoles: [],
    // Menyimpan pesan "panel" reaction role terakhir yang dibuat bot,
    // supaya /reactionrole add tidak perlu selalu isi message_id manual.
    // Bentuk: { channelId, messageId }
    lastReactionRolePanel: null,

    // Pesan panel musik tunggal per server. Disimpan agar panel yang sama
    // dapat dipakai lagi setelah bot restart/redeploy.
    musicPanel: null,
    // Riwayat lagu terakhir yang diputar di server ini.
    musicHistory: []
};

const DEFAULT_USER = {
    balance: 0,
    bank: 0,
    lastDaily: 0,
    lastWork: 0,
    xp: 0,
    level: 0,
    lastMessageXp: 0,

    // ==== Fase RPG/Economy lanjutan ====
    dailyStreak: 0,
    lastWeekly: 0,
    gambling: { wins: 0, losses: 0, gamesPlayed: 0, totalWagered: 0 },
    inventory: {}, // { itemId: qty }
    animals: [], // [{ instanceId, animalId, rarity, level, xp, caughtAt }]
    pets: [], // [{ instanceId, animalId, name, level, xp, hp, atk, def, spd }]
    activePetId: "",
    weapons: [], // [{ instanceId, weaponId, level, durability }]
    equippedWeaponId: "",
    achievementsClaimed: [], // id achievement yang sudah diklaim rewardnya
    badges: [],
    quests: { date: "", list: [], rerollsUsed: 0 },
    battle: { wins: 0, losses: 0 },
    marriage: { partnerId: "", marriedAt: 0 },
    stats: { huntCount: 0, cratesOpened: 0 },

    // ==== Music (v3) ====
    activeGames: {},
    favoriteSongs: [], // [{ name, url, addedAt }]
    playlists: {} // { "nama playlist": [{ name, url, duration, thumbnail, addedAt }] }
};

/**
 * Merge non-destruktif: field baru dari DEFAULT_USER ditambahkan ke user lama
 * TANPA menimpa data yang sudah ada. Dipakai supaya user lama (pre-RPG-update)
 * otomatis mendapat field baru (inventory, animals, quests, dst) tanpa reset data.
 */
function migrateUserShape(user) {
    let changed = false;
    for (const key of Object.keys(DEFAULT_USER)) {
        if (user[key] === undefined) {
            user[key] = typeof DEFAULT_USER[key] === "object" && DEFAULT_USER[key] !== null
                ? JSON.parse(JSON.stringify(DEFAULT_USER[key]))
                : DEFAULT_USER[key];
            changed = true;
        }
    }
    return changed;
}

function migrateGuildShape(guild) {
    let changed = false;
    for (const key of Object.keys(DEFAULT_GUILD)) {
        if (guild[key] === undefined) {
            guild[key] = typeof DEFAULT_GUILD[key] === "object" && DEFAULT_GUILD[key] !== null
                ? JSON.parse(JSON.stringify(DEFAULT_GUILD[key]))
                : DEFAULT_GUILD[key];
            changed = true;
        }
    }
    return changed;
}

let cache = null;
let runtime = null;
const backend = process.env.DATABASE_BACKEND || (process.env.NODE_ENV === "production" ? "supabase" : "legacy");
if (!["legacy", "supabase"].includes(backend)) throw new Error("Invalid DATABASE_BACKEND");
async function initialize() {
    if (backend === "supabase") {
        runtime = new (require("../src/database/repositories/runtimeRepository").RuntimeRepository)();
        cache = { ...structuredClone(DEFAULT_DB), ...await runtime.initialize() };
    } else load();
}
async function close() { await flush(); if (runtime) await runtime.close(); }
function status() { try { load(); return { ready:true, backend }; } catch { return {ready:false, backend}; } }
let writeQueue = Promise.resolve();

function ensureFile() {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        if (process.env.LEGACY_DATABASE_PATH) throw new Error("Configured legacy database missing; restore your backup before startup");
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 4));
    }
}

function load() {
    if (backend === "supabase") {
        if (!runtime || !cache) throw new Error("Supabase runtime must initialize before commands load");
        runtime.assertHealthy();
    }
    if (cache) return cache;
    ensureFile();
    try {
        const raw = fs.readFileSync(DB_PATH, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
            !parsed.users || typeof parsed.users !== "object" || Array.isArray(parsed.users) ||
            !parsed.guilds || typeof parsed.guilds !== "object" || Array.isArray(parsed.guilds) || !Array.isArray(parsed.blacklist)) {
            throw new Error("Invalid legacy database shape");
        }
        cache = { ...structuredClone(DEFAULT_DB), ...parsed };
    } catch (err) {
        throw new Error("Database legacy gagal dibaca. File dipertahankan; pulihkan backup sebelum melanjutkan.", { cause: err });
    }
    return cache;
}

// Semua penulisan file dilakukan berurutan (queued) supaya JSON tidak korup
// saat banyak event terjadi bersamaan (write-queue sederhana).
function persist() {
    const snapshot = JSON.stringify(load(), null, 4);
    const actor = require("../src/utils/requestContext").getStore()?.actor || "bot";
    const operation = writeQueue.catch(() => {}).then(async () => {
        if (runtime) return runtime.persist(JSON.parse(snapshot), actor);
        const tmpPath = `${DB_PATH}.tmp`;
        await fs.promises.writeFile(tmpPath, snapshot, { encoding: "utf8", mode: 0o600 });
        await fs.promises.rename(tmpPath, DB_PATH);
    });
    writeQueue = operation;
    // Legacy callers do not all await save yet; attach a handler without hiding
    // rejection from callers that explicitly await persistence.
    operation.catch((error) => console.error("[DATABASE] Persistence failed:", error.message));
    return operation;
}

function flush() { return writeQueue; }

function getDB() {
    const db = load();
    if (!db.lottery) {
        db.lottery = { date: "", pot: 0, tickets: {}, lastWinnerId: "", lastPot: 0 };
        save();
    }
    return db;
}

function save() {
    return persist();
}

function getGuild(guildId) {
    const db = load();
    if (!db.guilds[guildId]) {
        db.guilds[guildId] = JSON.parse(JSON.stringify(DEFAULT_GUILD));
        save();
        return db.guilds[guildId];
    }
    if (migrateGuildShape(db.guilds[guildId])) save();
    return db.guilds[guildId];
}

function updateGuild(guildId, data) {
    const db = load();
    const current = getGuild(guildId);
    const next = { ...data };
    for (const type of ["welcome", "goodbye"]) {
        if (Object.hasOwn(data, `${type}Channel`) && !data[type] && current[type]) next[type] = { ...current[type], channelId:data[`${type}Channel`] };
    }
    const configKeys = ["welcome", "welcomeChannel", "goodbye", "goodbyeChannel", "autoRole", "logChannel", "leveling", "prefix", "musicMode247", "automod", "ticket", "moderation"];
    if (!Object.hasOwn(data, "configVersion") && configKeys.some(key => Object.hasOwn(data, key))) next.configVersion = (current.configVersion || 0) + 1;
    db.guilds[guildId] = { ...current, ...next };
    save();
    return db.guilds[guildId];
}

function getUser(userId) {
    const db = load();
    if (!db.users[userId]) {
        db.users[userId] = JSON.parse(JSON.stringify(DEFAULT_USER));
        save();
        return db.users[userId];
    }
    if (migrateUserShape(db.users[userId])) save();
    return db.users[userId];
}

function updateUser(userId, data) {
    const db = load();
    db.users[userId] = { ...getUser(userId), ...data };
    save();
    return db.users[userId];
}

function updateUsers(updates) {
    const database = load();
    const next = {};
    for (const [id, data] of Object.entries(updates)) next[id] = { ...getUser(id), ...data };
    Object.assign(database.users, next);
    save();
    return next;
}

function isBlacklisted(userId) {
    const db = load();
    return db.blacklist.includes(userId);
}

function addBlacklist(userId) {
    const db = load();
    if (!db.blacklist.includes(userId)) db.blacklist.push(userId);
    save();
}

function removeBlacklist(userId) {
    const db = load();
    db.blacklist = db.blacklist.filter((id) => id !== userId);
    save();
}

function getWarnings(guildId, userId) {
    const db = load();
    const key = `${guildId}-${userId}`;
    return db.warnings[key] || [];
}

function addWarning(guildId, userId, warning) {
    const db = load();
    const key = `${guildId}-${userId}`;
    if (!db.warnings[key]) db.warnings[key] = [];
    db.warnings[key].push(warning);
    save();
    return db.warnings[key];
}

function clearWarnings(guildId, userId) {
    const db = load();
    const key = `${guildId}-${userId}`;
    db.warnings[key] = [];
    save();
}

module.exports = {
    initialize,
    close,
    status,
    getDB,
    flush,
    save,
    getGuild,
    updateGuild,
    getUser,
    updateUser,
    updateUsers,
    isBlacklisted,
    addBlacklist,
    removeBlacklist,
    getWarnings,
    addWarning,
    clearWarnings
};
