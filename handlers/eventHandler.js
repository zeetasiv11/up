const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger.js");

const EVENTS_DIR = path.join(__dirname, "..", "events");

// Loader mode "music" tetap disimpan untuk kompatibilitas project lama.
const MUSIC_ONLY_EVENTS = new Set(["ready", "clientReady", "interactionCreate"]);

/**
 * @param {import("discord.js").Client} client
 * @param {"full"|"music"} [mode]
 */
function loadEvents(client, mode = "full") {
    for (const { name, listener } of client.loadedEventHandlers || []) client.off(name, listener);
    client.loadedEventHandlers = [];
    const musicOnlyMode = mode === "music";
    const files = fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith(".js"));
    let count = 0;

    for (const file of files) {
        const filePath = path.join(EVENTS_DIR, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (!event?.name || !event?.execute) {
                logger.warn(`Event ${file} tidak valid, dilewati.`);
                continue;
            }

            if (musicOnlyMode && !MUSIC_ONLY_EVENTS.has(event.name)) continue;

            const listener = (...args) => {
                if (client.shuttingDown) return;
                client.pendingEventWork ||= new Set();
                const work = Promise.resolve().then(() => require("../src/utils/requestContext").run({ actor: args[0]?.user?.id || args[0]?.author?.id || "bot" }, () => event.execute(...args, client)))
                    .catch(error => logger.error(`Event ${event.name} failed: ${error.message}`))
                    .finally(() => client.pendingEventWork.delete(work));
                client.pendingEventWork.add(work);
                return work;
            };
            client.loadedEventHandlers.push({ name: event.name, listener });
            if (event.once) client.once(event.name, listener);
            else client.on(event.name, listener);
            count++;
        } catch (err) {
            logger.error(`Gagal memuat event ${file}: ${err.message}`);
        }
    }

    logger.info(`[${client.botLabel || (musicOnlyMode ? "MUSIC" : "MAIN")}] Berhasil memuat ${count} event.`);
}

module.exports = { loadEvents };
