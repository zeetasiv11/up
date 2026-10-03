const { Shoukaku, Connectors } = require("shoukaku");
const { LavalinkRest } = require("./LavalinkRest");
const { LavalinkNode } = require("./LavalinkNode");
const { LavalinkPlayer } = require("./LavalinkPlayer");
class LavalinkClient extends Shoukaku {
    addNode(options) {
        const node = new LavalinkNode(this, options);
        for (const event of ["debug", "reconnecting", "error", "close", "ready", "raw"])
            node.on(event, (...args) => this.emit(event, node.name, ...args));
        node.once("disconnect", () => {
            if (this.nodes.get(node.name) === node) this.nodes.delete(node.name);
            this.emit("disconnect", node.name);
        });
        this.nodes.set(node.name, node);
        void node.connect().catch((error) => this.emit("error", node.name, error));
    }
}
function createLavalink(client, logger, env = process.env) {
    const nodes = [];
    if (env.LAVALINK_HOST && env.LAVALINK_PASSWORD) {
        const port = Number(env.LAVALINK_PORT || 2333);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid LAVALINK_PORT");
        nodes.push({
            name: "primary",
            url: `${env.LAVALINK_HOST}:${port}`,
            auth: env.LAVALINK_PASSWORD,
            secure: env.LAVALINK_SECURE === "true",
        });
    } else logger.warn("Lavalink belum dikonfigurasi. Fitur bot lain tetap tersedia.");
    const manager = new LavalinkClient(new Connectors.DiscordJS(client), nodes, {
        structures: { rest: LavalinkRest, player: LavalinkPlayer },
        resume: true,
        resumeTimeout: 60,
        resumeByLibrary: true,
        reconnectTries: 100,
        reconnectInterval: 5,
        restTimeout: 15,
        voiceConnectionTimeout: 20,
    });
    manager.on("error", (name, error) =>
        logger.error(
            `[LAVALINK] Node error (${name}, HTTP ${Number.isInteger(error?.status) ? error.status : "transport"})`,
        ),
    );
    manager.on("ready", (name) => logger.info(`[LAVALINK] Node ready (${name})`));
    manager.on("resumeUnavailable", (name) =>
        logger.warn(
            `Lavalink ${name} does not permit server session resumption; library recovery remains enabled.`,
        ),
    );
    manager.on("close", (name) => logger.warn(`[LAVALINK] Node reconnecting (${name})`));
    manager.on("reconnecting", (name, remaining) =>
        logger.warn(`[LAVALINK] Reconnect (${name}, ${remaining} attempts left)`),
    );
    return manager;
}
module.exports = { createLavalink };
