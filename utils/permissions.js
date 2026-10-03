const { PermissionsBitField } = require("discord.js");
const settings = require("../settings.js");

/**
 * Cek apakah userId adalah Owner bot.
 * Ini TIDAK bisa dilewati walaupun user punya Administrator di Discord,
 * karena owner ditentukan murni dari settings.js (ownerIds), bukan dari role Discord.
 */
function isOwner(userId) {
    return settings.ownerIds.includes(userId);
}

function isAdmin(member) {
    if (!member) return false;
    if (isOwner(member.id)) return true;
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function isModerator(member) {
    if (!member) return false;
    if (isAdmin(member)) return true;
    return (
        member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
        member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
        member.permissions.has(PermissionsBitField.Flags.BanMembers)
    );
}

function botHasPermission(guild, permissionFlag) {
    const me = guild.members.me;
    if (!me) return false;
    return me.permissions.has(permissionFlag);
}

module.exports = {
    isOwner,
    isAdmin,
    isModerator,
    botHasPermission
};
