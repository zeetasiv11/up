try {
    process.loadEnvFile();
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
const mode = process.argv[2] || "bot";
const modes = {
    bot: ["DISCORD_TOKEN", "CLIENT_ID", "OWNER_IDS"],
    database: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
};
if (!Object.hasOwn(modes, mode)) throw new Error("Use validate-env.js bot|database");
const missing = modes[mode].filter((key) => !process.env[key]?.trim());
if (missing.length) {
    console.error(`Missing: ${missing.join(", ")}`);
    process.exitCode = 1;
} else console.log(`${mode} environment present. Connection not yet verified.`);
