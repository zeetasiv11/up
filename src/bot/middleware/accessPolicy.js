const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const { isOwner } = require("../../../utils/permissions.js");

function accessError(userId, guildId) {
    if (isOwner(userId)) return null;
    if (db.isBlacklisted(userId)) return "Kamu telah di-blacklist dan tidak dapat menggunakan bot ini.";
    if (db.getDB?.().stats?.maintenance ?? settings.maintenance.enabled) return settings.maintenance.message;
    if (guildId && db.getGuild(guildId).maintenance) return "Bot sedang maintenance di server ini.";
    return null;
}
module.exports = { accessError };
