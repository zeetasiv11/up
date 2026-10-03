const http = require("node:http");
const logger = require("./logger.js");
const database = require("./database.js");
function health(clients) {
    let dbReady = false;
    try { dbReady = Boolean(database.getDB()); } catch { /* health reports corruption without exposing details */ }
    const bot = clients.length > 0 && clients.every(client => client.isReady());
    const lavalink = clients.some(client => Boolean(client.music?.lavalink.getIdealNode()));
    const musicRequired = Boolean(process.env.LAVALINK_HOST);
    return { status: bot && dbReady && (!musicRequired || lavalink) ? "ok" : "degraded", bot, database: dbReady,
        databaseBackend: database.status().backend, lavalink, uptime: Math.floor(process.uptime()) };
}
function startKeepAliveServer(clientOrClients) {
    const clients = (Array.isArray(clientOrClients) ? clientOrClients : [clientOrClients]).filter(Boolean);
    const server = http.createServer((req, res) => {
        if (!["/", "/health", "/api/health", "/ready"].includes(req.url) || !["GET", "HEAD"].includes(req.method)) {
            res.writeHead(404); return res.end();
        }
        const body = health(clients);
        res.writeHead(req.url === "/ready" && body.status !== "ok" ? 503 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(body));
    });
    const port = Number(process.env.PORT || process.env.WEB_PORT || 3000);
    server.listen(port, "0.0.0.0", () => logger.info(`Health HTTP listening on ${port}`));
    return server;
}
module.exports = { startKeepAliveServer, health };
