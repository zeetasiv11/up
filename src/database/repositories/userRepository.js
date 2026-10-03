const { databaseClient } = require("../client.js");
function userRepository(client = databaseClient()) {
    return {
        async get(userId) {
            const { data, error } = await client
                .from("user_profiles")
                .select("user_id,data")
                .eq("user_id", userId)
                .maybeSingle();
            if (error) throw new Error("Could not read user profile", { cause: error });
            return data;
        },
    };
}
module.exports = { userRepository };
