const { z } = require("zod");
const { HttpError } = require("./auth");
const channel = z.string().regex(/^(?:\d{17,20})?$/);
const image = z.union([
    z.literal(""),
    z.url().refine((value) => value.startsWith("https://"), "Use an HTTPS URL"),
]);
const greeting = z
    .object({
        enabled: z.boolean(),
        channelId: channel,
        message: z.string().max(1800),
        title: z.string().max(180),
        description: z.string().max(1800),
        color: z.string().regex(/^#[\da-fA-F]{6}$/),
        image,
        thumbnail: z.boolean(),
        useCard: z.boolean(),
        dm: z.boolean(),
        buttonLabel: z.string().max(80),
        buttonUrl: image,
    })
    .strict();
const automod = z
    .object({
        enabled: z.boolean(),
        spam: z.boolean(),
        links: z.boolean(),
        invites: z.boolean(),
        mentions: z.boolean(),
        caps: z.boolean(),
        duplicates: z.boolean(),
        webhooks: z.boolean(),
        badWords: z.array(z.string().trim().min(1).max(100)).max(100),
        maxMessages: z.number().int().min(2).max(100),
        windowSeconds: z.number().int().min(1).max(60),
        maxMentions: z.number().int().min(1).max(100),
        capsPercent: z.number().int().min(20).max(100),
        timeoutMinutes: z.number().int().min(1).max(1440),
        action: z.enum(["delete", "timeout"]),
        massJoin: z.boolean(),
        antiRaid: z.boolean(),
        joinThreshold: z.number().int().min(2).max(100),
        joinWindowSeconds: z.number().int().min(1).max(60),
        minAccountDays: z.number().int().min(0).max(365),
        joinAction: z.enum(["log", "kick"]),
    })
    .strict();
const schema = z
    .object({
        ticket: z
            .object({
                categoryId: channel,
                supportRoleIds: z.array(channel).max(20),
                transcriptChannelId: channel,
                autoCloseHours: z.number().int().min(0).max(720),
            })
            .strict()
            .optional(),
        automod: automod.optional(),
        moderation: z.object({ dmNotifications: z.boolean() }).strict().optional(),
        welcome: greeting.optional(),
        goodbye: greeting.optional(),
        welcomeChannel: channel.optional(),
        goodbyeChannel: channel.optional(),
        autoRole: channel.optional(),
        logChannel: channel.optional(),
        leveling: z.boolean().optional(),
        musicMode247: z.boolean().optional(),
        prefix: z.string().min(1).max(8).regex(/^\S+$/).optional(),
    })
    .strict();
function createSettingsService(db, defaults) {
    const locks = new Map();
    return {
        get(guildId) {
            const data = db.getGuild(guildId);
            return {
                data,
                version: data.configVersion || 0,
                defaults: {
                    welcome: defaults.welcome,
                    goodbye: defaults.goodbye,
                    prefix: defaults.textCommandPrefix,
                },
            };
        },
        update(guild, actor, body) {
            const operation = (locks.get(guild.id) || Promise.resolve())
                .catch(() => {})
                .then(async () => {
                    const input = z
                        .object({ version: z.number().int().nonnegative(), patch: schema })
                        .strict()
                        .parse(body);
                    const current = this.get(guild.id);
                    if (input.version !== current.version)
                        throw new HttpError(409, "Settings changed elsewhere. Reload before saving.");
                    if (input.patch.automod || input.patch.moderation) {
                        const moderator = await guild.members.fetch(actor);
                        if (
                            !moderator.permissions.has("ModerateMembers") ||
                            (input.patch.automod?.joinAction === "kick" &&
                                !moderator.permissions.has("KickMembers"))
                        )
                            throw new HttpError(
                                403,
                                "Moderate Members (and Kick Members for join kicks) is required.",
                            );
                    }
                    if (input.patch.ticket) {
                        const actorMember = await guild.members.fetch(actor);
                        if (!actorMember.permissions.has("ManageChannels"))
                            throw new HttpError(403, "Manage Channels is required for tickets.");
                        const roles = await guild.roles.fetch();
                        if (input.patch.ticket.supportRoleIds.some((id) => id === guild.id || !roles.has(id)))
                            throw new HttpError(400, "Invalid ticket support role.");
                        if (
                            input.patch.ticket.categoryId &&
                            (await guild.channels.fetch(input.patch.ticket.categoryId))?.type !== 4
                        )
                            throw new HttpError(400, "Choose a channel category.");
                    }
                    const channels = await guild.channels.fetch();
                    for (const id of [
                        input.patch.welcome?.channelId,
                        input.patch.goodbye?.channelId,
                        input.patch.welcomeChannel,
                        input.patch.goodbyeChannel,
                        input.patch.logChannel,
                        input.patch.ticket?.transcriptChannelId,
                    ].filter(Boolean)) {
                        const target = channels.get(id);
                        if (!target?.isTextBased() || target.isThread?.())
                            throw new HttpError(400, "Choose a text channel in this server.");
                        if (
                            !target
                                .permissionsFor(guild.members.me)
                                ?.has(["ViewChannel", "SendMessages", "EmbedLinks"])
                        )
                            throw new HttpError(
                                400,
                                "Bot needs View Channel, Send Messages, and Embed Links.",
                            );
                    }
                    if (input.patch.autoRole) {
                        const actorMember = await guild.members.fetch(actor);
                        if (!actorMember.permissions.has("ManageRoles"))
                            throw new HttpError(
                                403,
                                "Manage Roles permission is required for automatic roles.",
                            );
                        const role = await guild.roles.fetch(input.patch.autoRole);
                        if (
                            !role ||
                            role.managed ||
                            role.id === guild.id ||
                            role.position >= guild.members.me.roles.highest.position ||
                            role.permissions.has("Administrator") ||
                            (guild.ownerId !== actor && role.position >= actorMember.roles.highest.position)
                        )
                            throw new HttpError(400, "Choose an assignable non-administrator role.");
                    }
                    if (this.get(guild.id).version !== input.version)
                        throw new HttpError(409, "Settings changed while validating. Reload before saving.");
                    const before = structuredClone(current.data);
                    const patch = { ...input.patch, configVersion: current.version + 1 };
                    if (patch.welcome) patch.welcomeChannel = patch.welcome.channelId;
                    if (patch.goodbye) patch.goodbyeChannel = patch.goodbye.channelId;
                    const audit = [
                        ...(current.data.configAudit || []),
                        {
                            actor,
                            action: "settings.update",
                            at: new Date().toISOString(),
                            fields: Object.keys(input.patch),
                        },
                    ].slice(-200);
                    db.updateGuild(guild.id, { ...patch, configAudit: audit });
                    try {
                        await db.flush();
                    } catch (error) {
                        Object.assign(db.getGuild(guild.id), before);
                        throw error;
                    }
                    return this.get(guild.id);
                });
            locks.set(guild.id, operation);
            void operation
                .finally(() => {
                    if (locks.get(guild.id) === operation) locks.delete(guild.id);
                })
                .catch(() => {});
            return operation;
        },
    };
}
module.exports = { createSettingsService, schema, greeting };
