try {
    process.loadEnvFile();
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
async function main() {
    const { LAVALINK_HOST: host, LAVALINK_PASSWORD: password } = process.env;
    if (!host || !password) throw new Error("LAVALINK_HOST and LAVALINK_PASSWORD required");
    const origin = `${process.env.LAVALINK_SECURE === "true" ? "https" : "http"}://${host}:${process.env.LAVALINK_PORT || 2333}`;
    const response = await fetch(`${origin}/v4/info`, {
        headers: { Authorization: password },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Lavalink health HTTP ${response.status}`);
    const info = await response.json();
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
