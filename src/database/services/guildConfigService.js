const { z } = require("zod");
const { guildRepository } = require("../repositories/guildRepository.js");
const id = z.string().regex(/^\d{17,20}$/);
const channel = z.union([id, z.literal("")]);
const patchSchema = z
    .object({
        welcomeChannel: channel.optional(),
        goodbyeChannel: channel.optional(),
        autoRole: channel.optional(),
        logChannel: channel.optional(),
        leveling: z.boolean().optional(),
        maintenance: z.boolean().optional(),
        musicMode247: z.boolean().optional(),
        prefix: z.string().min(1).max(8).optional(),
    })
    .strict();
function createGuildConfigService(repository = guildRepository()) {
    return {
        async get(guildId) {
            return repository.get(id.parse(guildId));
        },
        async update(guildId, patch, version, actorId) {
            id.parse(guildId);
            id.parse(actorId);
            z.number().int().nonnegative().parse(version);
            const data = patchSchema.parse(patch);
            const current = await repository.get(guildId);
            if (!current) throw new Error("Guild not found");
            if (current.version !== version) throw new Error("Settings changed; reload before saving");
            return repository.update(guildId, { ...current.data, ...data }, version, actorId);
        },
    };
}
module.exports = { createGuildConfigService };
