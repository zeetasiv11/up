const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const settings = require("./settings.js");
const logger = require("./utils/logger.js");
const { printBanner } = require("./utils/banner.js");
const { loadCommands } = require("./handlers/commandHandler.js");
const { loadEvents } = require("./handlers/eventHandler.js");
const { loadPrefixCommands } = require("./handlers/prefixCommandHandler.js");
const { startKeepAliveServer } = require("./utils/keepAlive.js");

const { setupMusic } = require("./utils/music.js");
printBanner();

if (!settings.token) {
    logger.error("Token bot UTAMA belum diisi! Isi Environment Variable DISCORD_TOKEN di dashboard Render (atau lokal via env var) dengan token bot kamu.");
    process.exit(1);
}
if (!settings.clientId) {
    logger.error("Client ID bot UTAMA belum diisi! Isi Environment Variable CLIENT_ID di dashboard Render (atau lokal via env var) dengan Application ID bot kamu.");
    process.exit(1);
}

const FULL_INTENTS = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
];

/**
 * Bikin & jalanin satu instance bot Discord (client + login).
 * Music berjalan langsung di client utama.
 *
 * @param {{ token: string, clientId: string, mode: "full"|"music", label: string }} config
 */
function startBot({ token, clientId, label }) {
    if (!token) {
        logger.error(`[${label}] Dilewati: token kosong.`);
        return null;
    }

    const client = new Client({
        intents: FULL_INTENTS,
        partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User]
    });

    client.botLabel = label;
    client.botToken = token;
    client.botClientId = clientId;
    client.botMode = "full";
    client.commands = new Collection();
    client.pendingBroadcasts = new Collection();

    loadCommands(client, "full");
    loadEvents(client, "full");
    setupMusic(client);

    client.login(token).catch((err) => {
        logger.error(`[${label}] Gagal login: ${err.message}`);
    });

    return client;
}

async function main() {
await require("./src/database/runtimeHandoff").initializeWithHandoff({
    initialize: () => require("./utils/database").initialize(), logger,
});
const clients = [];

// Bot UTAMA - akses semua fitur (moderation, economy, ticket, leveling, dst),
// termasuk kategori music.
const mainClient = startBot({ token: settings.token, clientId: settings.clientId, label: "UTAMA" });
if (mainClient) clients.push(mainClient);

// Prefix command "z..." cuma relevan buat bot utama (bot musik tidak
// memuat event messageCreate sama sekali - lihat handlers/eventHandler.js),
// jadi cukup dimuat sekali di sini.
loadPrefixCommands();

logger.info("Mode satu bot aktif: fitur musik berjalan di bot utama.");

// Server HTTP kecil supaya Render (kalau di-deploy sebagai Web Service)
// mendeteksi port aktif dan tidak menganggap deploy gagal. Tidak berpengaruh
// apa pun ke logic bot Discord-nya. Satu server buat SEMUA bot (dipanggil
// sekali saja, bukan per-client, karena cuma ada satu PORT per service).
const server = process.env.WEB_ENABLED === "true"
    ? require("./web/backend/server.js").startDashboard(mainClient)
    : startKeepAliveServer(clients);
let closing = false;
async function shutdown(fatal = false) {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 20000); deadline.unref();
    server.close();
    for (const client of clients) client.shuttingDown = true;
    try {
        await Promise.allSettled(clients.flatMap(client => [...(client.pendingEventWork || [])]));
        await Promise.allSettled(clients.map(client => client.music?.close()));
        await require("./utils/database.js").close();
        for (const client of clients) { clearInterval(client.ticketSweep); client.destroy(); }
        process.exitCode = fatal ? 1 : 0;
    } catch (error) { logger.error(`Shutdown failed: ${error.message}`); process.exitCode = 1; }
    finally { process.exit(process.exitCode); }
}
process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled promise rejection: ${err?.stack || err}`);
});
process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err?.stack || err}`);
    void shutdown(true);
});

return { mainClient, clients };
}
main().catch(error => { logger.error(`Startup failed: ${error.message}`); process.exit(1); });
