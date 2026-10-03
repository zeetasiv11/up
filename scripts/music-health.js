try {
    process.loadEnvFile();
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
async function main() {
    const { LAVALINK_HOST: host, LAVALINK_PASSWORD: password } = process.env;
    if (!host || !password) throw new Error("LAVALINK_HOST and LAVALINK_PASSWORD required");
    const { LavalinkRest } = require("../src/music/LavalinkRest");
    const rest = new LavalinkRest(
        { manager: { options: { userAgent: "Zeechei-Health/4.0", restTimeout: 10 } } },
        {
            url: `${host}:${process.env.LAVALINK_PORT || 2333}`,
            secure: process.env.LAVALINK_SECURE === "true",
            auth: password,
        },
    );
    const info = await rest.getLavalinkInfo();
    console.log(
        JSON.stringify({
            version: info.version.semver,
            sources: info.sourceManagers,
            filters: info.filters,
            plugins: info.plugins.map((p) => p.name),
        }),
    );
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
