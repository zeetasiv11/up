const fs = require("fs");
const path = require("path");
const { REST, Routes, Collection } = require("discord.js");
const settings = require("../settings.js");
const logger = require("../utils/logger.js");

const COMMANDS_DIR = path.join(__dirname, "..", "commands");

/**
 * Membaca semua file command dari commands/<category>/*.js
 * dan mengisi client.commands (Collection).
 *
 * @param {import("discord.js").Client} client
 * @param {"full"|"music"} [mode] - "music" dipertahankan untuk kompatibilitas
 *   loader lama; deployment saat ini hanya menjalankan mode "full".
 */
function loadCommands(client, mode = "full") {
    client.commands = new Collection();
    const categories = fs.readdirSync(COMMANDS_DIR).filter((f) =>
        fs.statSync(path.join(COMMANDS_DIR, f)).isDirectory()
    );

    const musicOnlyMode = mode === "music";
    const extraAllowList = new Set((settings.musicOnlyExtraCommands || []).map((n) => n.toLowerCase()));

    let count = 0;
    let skipped = 0;
    for (const category of categories) {
        if (musicOnlyMode && category !== "music") {
            skipped++;
            continue;
        }

        const categoryPath = path.join(COMMANDS_DIR, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));

        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (!command?.data || !command?.execute) {
                    logger.warn(`Command ${file} tidak valid (tidak ada 'data' atau 'execute'), dilewati.`);
                    continue;
                }

                command.category = category;
                client.commands.set(command.data.name, command);
                count++;
            } catch (err) {
                logger.error(`Gagal memuat command ${file}: ${err.message}`);
            }
        }
    }

    // Command utility dasar tetap ikut bila loader kompatibilitas mode "music"
    // dipakai dari deployment lama.
    if (musicOnlyMode && extraAllowList.size) {
        const utilityPath = path.join(COMMANDS_DIR, "utility");
        if (fs.existsSync(utilityPath)) {
            const files = fs.readdirSync(utilityPath).filter((f) => f.endsWith(".js"));
            for (const file of files) {
                const nameNoExt = path.basename(file, ".js").toLowerCase();
                if (!extraAllowList.has(nameNoExt)) continue;
                const filePath = path.join(utilityPath, file);
                try {
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    if (!command?.data || !command?.execute) continue;
                    command.category = "utility";
                    client.commands.set(command.data.name, command);
                    count++;
                } catch (err) {
                    logger.error(`Gagal memuat command ${file}: ${err.message}`);
                }
            }
        }
    }

    if (musicOnlyMode) {
        logger.info(`[${client.botLabel || "MUSIC"}] Mode musik-saja -> hanya command musik (+utility dasar). ${skipped} kategori lain dilewati.`);
    }
    logger.info(`[${client.botLabel || "MAIN"}] Berhasil memuat ${count} command.`);
    return client.commands;
}

/**
 * Mendaftarkan slash command ke Discord API untuk SATU client/bot tertentu.
 * @param {import("discord.js").Client} client
 * @param {{ token?: string, clientId?: string, guildId?: string }} [creds] -
 *   kredensial bot ini. Kalau tidak diisi, fallback ke settings.token/clientId/guildId
 *   (bot utama) supaya tetap kompatibel dengan pemanggilan lama.
 */
async function registerCommands(client, creds = {}) {
    const token = creds.token || client.botToken || settings.token;
    const clientId = creds.clientId || client.botClientId || settings.clientId;
    const guildId = creds.guildId !== undefined ? creds.guildId : settings.guildId;

    if (!token || !clientId) {
        logger.error(`[${client.botLabel || "BOT"}] Tidak bisa mendaftarkan slash command: token/clientId kosong.`);
        return;
    }

    const body = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
    const rest = new REST({ version: "10" }).setToken(token);

    try {
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
            logger.info(`[${client.botLabel || "BOT"}] Slash command terdaftar ke guild ${guildId} (${body.length} command).`);
        } else {
            await rest.put(Routes.applicationCommands(clientId), { body });
            logger.info(`[${client.botLabel || "BOT"}] Slash command terdaftar secara global (${body.length} command).`);
        }
    } catch (err) {
        logger.error(`[${client.botLabel || "BOT"}] Gagal mendaftarkan slash command: ${err.message}`);
    }
}

module.exports = { loadCommands, registerCommands };
