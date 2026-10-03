const { createHash } = require("node:crypto");
const ID = /^\d{17,20}$/;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const TABLES = [
    "guilds",
    "users",
    "moderation_cases",
    "guild_settings",
    "user_profiles",
    "user_economy",
    "user_inventory",
    "user_animals",
    "user_pets",
    "user_weapons",
    "user_quests",
    "user_achievements",
    "user_marriages",
    "user_statistics",
    "user_music_favorites",
    "user_music_playlists",
    "guild_music_panels",
    "guild_music_history",
    "guild_reaction_roles",
    "guild_bosses",
    "warnings",
    "tickets",
    "reminders",
    "afk_users",
    "blacklist",
    "bot_statistics",
    "lottery_rounds",
];
function assert(condition, message) {
    if (!condition) throw new Error(`Legacy validation: ${message}`);
}
function validateTree(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
        assert(!["__proto__", "prototype", "constructor"].includes(key), `reserved key ${key}`);
        validateTree(child);
    }
}
function normalizeLegacy(source) {
    assert(object(source), "root must be an object");
    validateTree(source);
    for (const field of ["guilds", "users"]) assert(object(source[field]), `${field} must be an object`);
    for (const field of ["warnings", "tickets", "afk", "stats", "lottery"]) {
        if (source[field] !== undefined) assert(object(source[field]), `${field} must be an object`);
    }
    for (const field of ["blacklist", "reminders"])
        if (source[field] !== undefined) assert(Array.isArray(source[field]), `${field} must be an array`);
    const rows = Object.fromEntries(TABLES.map((table) => [table, []]));
    const checkedId = (id) => {
        assert(ID.test(id), "invalid Discord ID");
        return id;
    };
    for (const [guildId, guild] of Object.entries(source.guilds)) {
        checkedId(guildId);
        assert(object(guild), "guild must be an object");
        rows.guilds.push({ id: guildId });
        rows.guild_settings.push({ guild_id: guildId, data: guild });
        if (guild.musicPanel) {
            assert(object(guild.musicPanel), "invalid music panel");
            rows.guild_music_panels.push({
                guild_id: guildId,
                channel_id: checkedId(guild.musicPanel.channelId),
                message_id: checkedId(guild.musicPanel.messageId),
                theme: "zeechei",
                enabled: true,
            });
        }
        for (const [field, table] of [
            ["musicHistory", "guild_music_history"],
            ["reactionRoles", "guild_reaction_roles"],
        ]) {
            assert(guild[field] === undefined || Array.isArray(guild[field]), `${field} must be an array`);
            (guild[field] || []).forEach((data, i) => {
                assert(object(data), `invalid ${field} entry`);
                rows[table].push({ id: `${guildId}:${i}`, guild_id: guildId, data });
            });
        }
        assert(
            guild.moderationCases === undefined || Array.isArray(guild.moderationCases),
            "invalid moderation cases",
        );
        for (const entry of guild.moderationCases || []) {
            assert(object(entry) && typeof entry.id === "string" && entry.id.length > 0, "invalid case");
            rows.moderation_cases.push({ id: entry.id, guild_id: guildId, data: entry });
        }
        if (guild.boss) rows.guild_bosses.push({ guild_id: guildId, data: guild.boss });
    }
    for (const [userId, user] of Object.entries(source.users)) {
        checkedId(userId);
        assert(object(user), "user must be an object");
        rows.users.push({ id: userId });
        rows.user_profiles.push({ user_id: userId, data: user });
        for (const key of ["balance", "bank"])
            assert(Number.isSafeInteger(user[key] ?? 0) && (user[key] ?? 0) >= 0, `invalid ${key}`);
        rows.user_economy.push({
            user_id: userId,
            balance: user.balance ?? 0,
            bank: user.bank ?? 0,
            data: Object.fromEntries(
                ["lastDaily", "lastWeekly", "lastWork", "dailyStreak"]
                    .filter((k) => user[k] !== undefined)
                    .map((k) => [k, user[k]]),
            ),
        });
        assert(user.inventory === undefined || object(user.inventory), "invalid inventory");
        for (const [itemId, quantity] of Object.entries(user.inventory || {})) {
            assert(Number.isSafeInteger(quantity) && quantity >= 0, "invalid inventory quantity");
            rows.user_inventory.push({ user_id: userId, item_id: itemId, quantity });
        }
        for (const [field, table] of [
            ["animals", "user_animals"],
            ["pets", "user_pets"],
            ["weapons", "user_weapons"],
            ["favoriteSongs", "user_music_favorites"],
        ]) {
            assert(user[field] === undefined || Array.isArray(user[field]), `invalid ${field}`);
            (user[field] || []).forEach((data, i) => {
                assert(object(data), `invalid ${field} entry`);
                rows[table].push({ id: `${userId}:${data.instanceId || i}`, user_id: userId, data });
            });
        }
        if (user.quests) {
            assert(object(user.quests) && Array.isArray(user.quests.list), "invalid quests");
            rows.user_quests.push({ user_id: userId, data: user.quests });
        }
        assert(
            user.achievementsClaimed === undefined || Array.isArray(user.achievementsClaimed),
            "invalid achievements",
        );
        for (const achievement of user.achievementsClaimed || []) {
            assert(typeof achievement === "string", "invalid achievement ID");
            rows.user_achievements.push({ user_id: userId, achievement_id: achievement });
        }
        if (user.marriage?.partnerId)
            rows.user_marriages.push({
                user_id: userId,
                partner_id: checkedId(user.marriage.partnerId),
                data: user.marriage,
            });
        rows.user_statistics.push({
            user_id: userId,
            data: { stats: user.stats || {}, gambling: user.gambling || {}, battle: user.battle || {} },
        });
        assert(user.playlists === undefined || object(user.playlists), "invalid playlists");
        for (const [name, tracks] of Object.entries(user.playlists || {})) {
            assert(Array.isArray(tracks) && tracks.every(object), "invalid playlist tracks");
            rows.user_music_playlists.push({ user_id: userId, name, data: tracks });
        }
    }
    for (const [key, values] of Object.entries(source.warnings || {})) {
        const [guildId, userId] = key.split("-");
        checkedId(guildId);
        checkedId(userId);
        assert(Array.isArray(values), "warnings must be an array");
        values.forEach((data, i) => {
            assert(object(data), "invalid warning");
            rows.warnings.push({ id: `${key}:${i}`, guild_id: guildId, user_id: userId, data });
        });
    }
    for (const [id, data] of Object.entries(source.tickets || {})) {
        assert(object(data), "invalid ticket");
        rows.tickets.push({ id, data });
    }
    (source.reminders || []).forEach((data, i) => {
        assert(object(data), "invalid reminder");
        rows.reminders.push({ id: String(data.id || `legacy:${i}`), data });
    });
    for (const [userId, data] of Object.entries(source.afk || {})) {
        checkedId(userId);
        assert(object(data), "invalid AFK");
        rows.afk_users.push({ user_id: userId, data });
    }
    for (const id of source.blacklist || []) rows.blacklist.push({ user_id: checkedId(id) });
    rows.bot_statistics.push({ id: "global", data: source.stats || {} });
    if (source.lottery)
        rows.lottery_rounds.push({ id: source.lottery.date || "legacy", data: source.lottery });
    // Reject duplicate keys before contacting Supabase rather than silently losing a record.
    for (const table of TABLES) {
        const seen = new Set();
        for (const row of rows[table]) {
            const key = JSON.stringify([
                row.id ?? row.guild_id ?? row.user_id,
                row.item_id,
                row.achievement_id,
                row.name,
            ]);
            assert(!seen.has(key), `duplicate primary key in ${table}`);
            seen.add(key);
        }
    }
    return { rows, counts: Object.fromEntries(TABLES.map((table) => [table, rows[table].length])) };
}
module.exports = { normalizeLegacy, TABLES, hash };
