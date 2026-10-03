const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

function missingConfiguration(env = process.env) {
    const required = ["DISCORD_TOKEN", "CLIENT_ID", "OWNER_IDS"];
    const backend = env.DATABASE_BACKEND || (env.NODE_ENV === "production" ? "supabase" : "legacy");
    if (backend === "supabase") required.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
    if (env.WEB_ENABLED === "true") required.push("WEB_URL", "DISCORD_CLIENT_SECRET", "SESSION_SECRET");
    return required.filter((key) => !env[key]?.trim() || (key === "SESSION_SECRET" && env[key].length < 32));
}

// Configuration mode serves public assets only. It never loads Discord, the
// legacy database, Supabase, OAuth sessions or any authenticated application API.
function createSetupServer() {
    const assets = new Map([
        ["/", ["index.html", "text/html"]],
        ["/app.js", ["app.js", "text/javascript"]],
        ["/styles.css", ["styles.css", "text/css"]],
    ]);
    const server = http.createServer(async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        );
        const json = (status, data) => {
            res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(data));
        };
        try {
            const route = new URL(req.url, "http://localhost").pathname;
            if (req.method !== "GET") return json(405, { error: "Setup is incomplete." });
            if (assets.has(route)) {
                const [name, type] = assets.get(route);
                const content = await fs.readFile(path.join(__dirname, "../web/frontend", name));
                res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
                return res.end(content);
            }
            if (["/health", "/api/health", "/ready"].includes(route))
                return json(503, {
                    status: "configuration_required",
                    bot: false,
                    database: false,
                    lavalink: false,
                    uptime: process.uptime(),
                });
            if (route === "/api/config")
                return json(200, {
                    setupRequired: true,
                    oauthConfigured: false,
                    botOnline: false,
                    storage: "not_initialized",
                    version: "V4+++ preview",
                });
            if (route === "/api/user") return json(401, { error: "Setup is incomplete." });
            return json(404, { error: "Not found." });
        } catch {
            if (!res.headersSent) json(500, { error: "Unable to load this page." });
            else res.end();
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    return server;
}

function start() {
    try {
        process.loadEnvFile();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    const missing = missingConfiguration();
    if (!missing.length) {
        if (process.env.MIGRATE_LEGACY_ON_START === "true") {
            const backend =
                process.env.DATABASE_BACKEND ||
                (process.env.NODE_ENV === "production" ? "supabase" : "legacy");
            if (backend !== "supabase")
                throw new Error("MIGRATE_LEGACY_ON_START requires DATABASE_BACKEND=supabase");
            return require("../database/migration/bootstrap")
                .bootstrap()
                .then((result) => {
                    console.info(JSON.stringify({ service: "migration", ...result }));
                    return require("../index.js");
                });
        }
        return require("../index.js");
    }
    // The setup landing page must be explicitly enabled by the service owner.
    if (process.env.SETUP_MODE !== "true") {
        console.error(`Missing configuration: ${missing.join(", ")}`);
        process.exitCode = 1;
        return;
    }
    console.warn(`Configuration required before bot startup: ${missing.join(", ")}`);
    const server = createSetupServer();
    const port = Number(process.env.PORT || process.env.WEB_PORT || 3000);
    server.listen(port, "0.0.0.0", () =>
        console.info(`Configuration page listening on ${port}; bot is not running.`),
    );
    for (const signal of ["SIGTERM", "SIGINT"])
        process.once(signal, () => {
            server.close();
            server.closeAllConnections();
        });
    return server;
}
if (require.main === module) {
    Promise.resolve()
        .then(start)
        .catch((error) => {
            // Migration diagnostics contain fixed guidance, never provider payloads.
            console.error(`Startup failed: ${error.message}`);
            process.exitCode = 1;
        });
}
module.exports = { missingConfiguration, createSetupServer, start };
