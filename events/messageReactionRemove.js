const settings = require("../settings.js");
const { createErrorEmbed, createInfoEmbed } = require("../utils/embeds.js");
const { findMapping } = require("../utils/reactionRoles.js");
const logger = require("../utils/logger.js");

module.exports = {
    name: "messageReactionRemove",
    once: false,
    async execute(reaction, user) {
        try {
            if (!settings.reactionRoles.enabled) return;
            if (!settings.reactionRoles.removeOnUnreact) return;
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (err) {
                    return;
                }
            }
            if (!reaction.message.guild) return;

            const guild = reaction.message.guild;
            const mapping = findMapping(guild.id, reaction.message.id, reaction.emoji);
            if (!mapping) return;

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const role = guild.roles.cache.get(mapping.roleId);
            if (!role) return;
            if (!member.roles.cache.has(role.id)) return;

            try {
                await member.roles.remove(role, "Reaction role dilepas (unreact)");
                await logger.sendLog(
                    reaction.message.client,
                    guild.id,
                    createInfoEmbed(`${member} kehilangan role ${role} karena melepas reaction role.`, "🎭 Reaction Role")
                );
            } catch (err) {
                logger.error(`Gagal melepas reaction role: ${err.message}`);
                await logger.sendLog(
                    reaction.message.client,
                    guild.id,
                    createErrorEmbed(`Gagal melepas role ${role} dari ${member} (reaction role): ${err.message}`)
                );
            }
        } catch (err) {
            logger.error(`messageReactionRemove error: ${err.message}`);
        }
    }
};
