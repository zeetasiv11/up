const { databaseClient } = require("../client.js");
function guildRepository(client = databaseClient()) {
    return {
        async get(guildId) {
            const { data, error } = await client
                .from("guild_settings")
                .select("data,version")
                .eq("guild_id", guildId)
                .maybeSingle();
            if (error) throw new Error("Could not read guild settings", { cause: error });
            return data;
        },
        async update(guildId, data, version, actorId) {
            const { data: result, error } = await client.rpc("update_guild_settings", {
                target_guild: guildId,
                expected_version: version,
                next_data: data,
                actor: actorId,
            });
            if (error)
                throw new Error(
                    error.code === "40001"
                        ? "Settings changed; reload before saving"
                        : "Could not save settings",
                    { cause: error },
                );
            return result;
        },
    };
}
module.exports = { guildRepository };
