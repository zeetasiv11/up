const db = require("../../../utils/database");
const settings = require("../../../settings");
const { recordCase } = require("../moderation/caseService");
const logger = require("../../../utils/logger");
const buckets = new Map(),
    joins = new Map();
const defaults = {
    enabled: false,
    spam: false,
    links: false,
    invites: false,
    mentions: false,
    caps: false,
    duplicates: false,
    webhooks: false,
    badWords: [],
    maxMessages: 5,
    windowSeconds: 5,
    maxMentions: 5,
    capsPercent: 70,
    timeoutMinutes: 5,
    action: "delete",
    massJoin: false,
    antiRaid: false,
    joinThreshold: 10,
    joinWindowSeconds: 10,
    minAccountDays: 0,
    joinAction: "log",
};
function config(guildId) {
    const legacy = settings.antiSpam;
    return {
        ...defaults,
        enabled: legacy.enabled,
        spam: legacy.enabled,
        mentions: legacy.enabled,
        caps: legacy.enabled,
        maxMessages: legacy.maxMessages,
        windowSeconds: legacy.intervalSeconds,
        maxMentions: legacy.maxMentions,
        capsPercent: legacy.maxCapsPercent,
        timeoutMinutes: legacy.muteMinutes,
        action: "timeout",
        ...db.getGuild(guildId).automod,
    };
}
function detect(message, c, now = Date.now()) {
    const key = `${message.guild.id}:${message.author.id}`;
    if (buckets.size > 10000)
        for (const [id, bucket] of buckets) if (now - bucket.last > 120000) buckets.delete(id);
    if (buckets.size > 20000) buckets.delete(buckets.keys().next().value);
    const bucket = buckets.get(key) || { times: [], content: "", duplicates: 0, last: now };
    bucket.times = bucket.times.filter((time) => now - time < c.windowSeconds * 1000);
    bucket.times.push(now);
    bucket.times = bucket.times.slice(-101);
    const content = message.content || "";
    bucket.duplicates =
        content && content === bucket.content && now - bucket.last < c.windowSeconds * 1000
            ? bucket.duplicates + 1
            : 1;
    bucket.content = content;
    bucket.last = now;
    buckets.set(key, bucket);
    const letters = content.replace(/[^a-z]/gi, "");
    const reasons = [];
    if (c.spam && bucket.times.length > c.maxMessages) reasons.push("spam");
    if (c.links && /https?:\/\/|www\./i.test(content)) reasons.push("link");
    if (c.invites && /(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(content)) reasons.push("invite");
    if (
        c.mentions &&
        (message.mentions.users.size + message.mentions.roles.size > c.maxMentions ||
            message.mentions.everyone)
    )
        reasons.push("mention spam");
    if (
        c.caps &&
        letters.length >= 10 &&
        (letters.replace(/[^A-Z]/g, "").length / letters.length) * 100 >= c.capsPercent
    )
        reasons.push("caps");
    if (c.duplicates && bucket.duplicates >= 3) reasons.push("duplicate message");
    if (c.webhooks && message.webhookId) reasons.push("webhook");
    if (c.badWords.some((word) => word && content.toLocaleLowerCase().includes(word.toLocaleLowerCase())))
        reasons.push("blocked word");
    return reasons;
}
async function handleMessage(message) {
    const c = config(message.guild.id);
    if (!c.enabled) return false;
    if (!message.webhookId && (message.author.bot || message.member?.permissions.has("ManageMessages")))
        return false;
    const reasons = detect(message, c);
    if (!reasons.length) return false;
    try {
        if (message.deletable) await message.delete();
        if (c.action === "timeout" && message.member?.moderatable)
            await message.member.timeout(c.timeoutMinutes * 60000, `AutoMod: ${reasons.join(", ")}`);
        await recordCase(message.guild, {
            action: "automod",
            actorId: message.client.user.id,
            targetId: message.author.id,
            reason: reasons.join(", "),
            metadata: { channelId: message.channelId, messageId: message.id },
        });
    } catch (error) {
        logger.warn("AutoMod action failed", { guild: message.guild.id, error: error.message });
    }
    return true;
}
async function handleJoin(member) {
    const c = config(member.guild.id);
    if (!c.enabled) return;
    const now = Date.now(),
        state = joins.get(member.guild.id) || { times: [], raidUntil: 0 };
    state.times = state.times.filter((at) => now - at < c.joinWindowSeconds * 1000);
    state.times.push(now);
    state.times = state.times.slice(-101);
    if (c.antiRaid && state.times.length >= c.joinThreshold) state.raidUntil = now + 300000;
    joins.set(member.guild.id, state);
    if (joins.size > 10000)
        for (const [id, s] of joins)
            if (s.raidUntil < now && !s.times.some((at) => now - at < 300000)) joins.delete(id);
    const reasons = [];
    if (c.minAccountDays > 0 && now - member.user.createdTimestamp < c.minAccountDays * 86400000)
        reasons.push("account age");
    if (c.massJoin && state.times.length === c.joinThreshold) reasons.push("mass join");
    if (c.antiRaid && state.raidUntil > now) reasons.push("raid protection");
    if (!reasons.length) return;
    if (c.joinAction === "kick" && member.kickable) await member.kick(`AutoMod: ${reasons.join(", ")}`);
    await recordCase(member.guild, {
        action: `automod.join.${c.joinAction}`,
        actorId: member.client.user.id,
        targetId: member.id,
        reason: reasons.join(", "),
    });
}
module.exports = { defaults, config, detect, handleMessage, handleJoin };
