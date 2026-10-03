const { Shoukaku, Connectors } = require("shoukaku");
const { LavalinkRest } = require("./LavalinkRest");
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
    const manager = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
        structures: { rest: LavalinkRest },
        resume: true,
        resumeTimeout: 60,
        resumeByLibrary: true,
        reconnectTries: 100,
        reconnectInterval: 5,
        restTimeout: 15,
        voiceConnectionTimeout: 20,
    });
    manager.on("error", (name, error) => logger.error(`Lavalink ${name}: ${error.message}`));
    manager.on("ready", (name) => logger.info(`Lavalink ${name} ready`));
    manager.on("resumeUnavailable", (name) =>
        logger.warn(
            `Lavalink ${name} does not permit server session resumption; library recovery remains enabled.`,
        ),
    );
    manager.on("close", (name) => logger.warn(`Lavalink ${name} reconnecting`));
    return manager;
}
module.exports = { createLavalink };
