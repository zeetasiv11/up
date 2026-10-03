const settings = require("../settings.js");
const { createErrorEmbed, createInfoEmbed } = require("../utils/embeds.js");
const { findMapping } = require("../utils/reactionRoles.js");
const logger = require("../utils/logger.js");

module.exports = {
    name: "messageReactionAdd",
    once: false,
    async execute(reaction, user) {
        try {
            if (!settings.reactionRoles.enabled) return;
            if (user.bot) return;

            // Partial -> perlu di-fetch dulu supaya data lengkap (message id, emoji, dll).
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (err) {
                    return; // pesan/reaction sudah dihapus, abaikan saja
                }
            }
            if (!reaction.message.guild) return; // abaikan DM

            const guild = reaction.message.guild;
            const mapping = findMapping(guild.id, reaction.message.id, reaction.emoji);
            if (!mapping) return;

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const role = guild.roles.cache.get(mapping.roleId);
            if (!role) {
                logger.warn(`Reaction role: role ${mapping.roleId} tidak ditemukan di guild ${guild.id}`);
                return;
            }

            if (member.roles.cache.has(role.id)) return; // sudah punya role

            try {
                await member.roles.add(role, "Reaction role");
                await logger.sendLog(
                    reaction.message.client,
                    guild.id,
                    createInfoEmbed(`${member} mendapatkan role ${role} lewat reaction role.`, "🎭 Reaction Role")
                );
            } catch (err) {
                logger.error(`Gagal memberikan reaction role: ${err.message}`);
                await logger.sendLog(
                    reaction.message.client,
                    guild.id,
                    createErrorEmbed(`Gagal memberikan role ${role} ke ${member} (reaction role): ${err.message}`)
                );
            }
        } catch (err) {
            logger.error(`messageReactionAdd error: ${err.message}`);
        }
    }
};
