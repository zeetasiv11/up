const http = require("node:http");
const { setTimeout: wait } = require("node:timers/promises");

function createHandoffServer() {
    return http.createServer((req, res) => {
        // Render checks / to move traffic and retire the old process. This is
        // process liveness only: application APIs and /ready remain unavailable.
        const live = ["GET", "HEAD"].includes(req.method) && req.url === "/";
        res.writeHead(live ? 200 : 503, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Retry-After": "5",
            "X-Content-Type-Options": "nosniff",
        });
        res.end(JSON.stringify({ status: "restarting", bot: false, database: false, lavalink: false }));
    });
}
async function listen(env) {
    const server = createHandoffServer();
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(Number(env.PORT || env.WEB_PORT || 3000), "0.0.0.0", resolve);
    });
    return () =>
        new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
}
async function initializeWithHandoff({
    initialize,
    logger,
    env = process.env,
    delay = wait,
    open = listen,
    timeoutMs = 180000,
}) {
    let close;
    const deadline = Date.now() + timeoutMs;
    try {
        while (true) {
            try {
                return await initialize();
            } catch (error) {
                const held = error.cause?.message === "Another bot instance owns the runtime lease";
                if (env.RUNTIME_HANDOFF !== "true" || !held || Date.now() >= deadline) throw error;
                if (!close) {
                    close = await open(env);
                    logger.info(
                        "Waiting for previous bot process to release database lease; application readiness remains unavailable.",
                    );
                }
                await delay(5000);
            }
        }
    } finally {
        if (close) await close();
    }
}
module.exports = { initializeWithHandoff, createHandoffServer };
