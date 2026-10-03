const { randomUUID } = require("node:crypto");
const db = require("../../../utils/database");
const logger = require("../../../utils/logger");
const { createInfoEmbed } = require("../../../utils/embeds");
async function recordCase(
    guild,
    { action, actorId, targetId = null, reason = "", evidence = "", metadata = {} },
) {
    const config = db.getGuild(guild.id);
    const entry = {
        id: randomUUID(),
        number: (config.moderationCaseCount || 0) + 1,
        action,
        actorId,
        targetId,
        reason: reason.slice(0, 1000),
        evidence: evidence.slice(0, 1000),
        metadata,
        timestamp: Date.now(),
    };
    db.updateGuild(guild.id, {
        moderationCaseCount: entry.number,
        moderationCases: [...(config.moderationCases || []), entry],
    });
    await db.flush();
    const embed = createInfoEmbed(
        `**Action:** ${action}\n**Target:** ${targetId ? `<@${targetId}>` : "Channel"}\n**Moderator:** <@${actorId}>\n**Reason:** ${entry.reason || "Not provided"}`,
        `Case #${entry.number}`,
    );
    await logger.sendLog(guild.client, guild.id, embed);
    if (config.moderation?.dmNotifications && targetId && actorId !== targetId) {
        const user = await guild.client.users.fetch(targetId).catch(() => null);
        await user?.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    }
    return entry;
}
async function recordInteraction(interaction, action) {
    const get = (kind, name) => {
        try {
            return interaction.options[kind](name);
        } catch {
            return null;
        }
    };
    const entry = await recordCase(interaction.guild, {
        action,
        actorId: interaction.user.id,
        targetId: get("getUser", "user")?.id || get("getString", "userid"),
        reason: get("getString", "reason") || "",
        evidence: get("getString", "evidence") || "",
        metadata: { channelId: interaction.channelId },
    });
    interaction.moderationCaseNumber = entry.number;
    return entry;
}
module.exports = { recordCase, recordInteraction };
