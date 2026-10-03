require("../settings");
const { databaseClient } = require("../src/database/client");
(async () => {
    const { error } = await databaseClient().from("bot_runtime").select("revision").limit(1);
    if (error)
        throw new Error(
            "Supabase schema/query check failed. Check credentials and apply schema.sql + runtime.sql.",
        );
    console.log("Supabase runtime table reachable. This does not verify migration contents.");
})().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
