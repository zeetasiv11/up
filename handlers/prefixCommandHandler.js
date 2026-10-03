/**
 * ============================================
 *  PREFIXLESS TEXT COMMAND HANDLER (Z COMMANDS)
 *  zcash, zubj, zslots, dst — TANPA slash "/".
 *
 *  - Registry berbasis Map (bukan if/else raksasa)
 *  - Case-insensitive
 *  - Hanya token pertama yang dicek terhadap registry
 *  - Tidak melakukan apapun untuk chat biasa
 * ============================================
 */

const fs = require("fs");
const path = require("path");
const settings = require("../settings.js");
const logger = require("../utils/logger.js");
const { createErrorEmbed } = require("../utils/embeds.js");

const PREFIX_COMMANDS_DIR = path.join(__dirname, "..", "commands", "prefix");

// name -> command definition
const registry = new Map();
// alias (lowercase) -> canonical name
const aliasMap = new Map();

function loadPrefixCommands() {
    registry.clear();
    aliasMap.clear();

    if (!fs.existsSync(PREFIX_COMMANDS_DIR)) return registry;

    const categories = fs.readdirSync(PREFIX_COMMANDS_DIR).filter((f) => fs.statSync(path.join(PREFIX_COMMANDS_DIR, f)).isDirectory());

    let count = 0;
    for (const category of categories) {
        const categoryPath = path.join(PREFIX_COMMANDS_DIR, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));

        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (!command?.name || typeof command?.execute !== "function") {
                    logger.warn(`[COMMAND] Prefix command ${file} tidak valid (butuh 'name' & 'execute'), dilewati.`);
                    continue;
                }

                const name = command.name.toLowerCase();
                command.category = command.category || category;
                registry.set(name, command);
                aliasMap.set(name, name);

                for (const alias of command.aliases || []) {
                    aliasMap.set(alias.toLowerCase(), name);
                }
                count++;
            } catch (err) {
                logger.error(`[COMMAND] Gagal memuat prefix command ${file}: ${err.message}`);
            }
        }
    }

    logger.info(`[COMMAND] Berhasil memuat ${count} prefix command (Z command).`);
    return registry;
}

/**
 * Parse pesan menjadi { commandName, args } atau null jika bukan command.
 * Hanya token PERTAMA yang dicek — mencegah bot memproses chat biasa
 * seperti "aku mau main ubj nanti".
 */
function parseMessage(content, guildId) {
    const prefix = ((guildId && require("../utils/database").getGuild(guildId).prefix) || settings.textCommandPrefix || "z").toLowerCase();
    if (!content) return null;

    const trimmed = content.trim();
    if (trimmed.length <= prefix.length) return null;

    const lower = trimmed.toLowerCase();
    if (!lower.startsWith(prefix)) return null;

    const tokens = trimmed.split(/\s+/);
    const firstToken = tokens[0].toLowerCase();

    if (!firstToken.startsWith(prefix)) return null;
    const commandWord = firstToken.slice(prefix.length);
    if (!commandWord) return null;

    const canonicalName = aliasMap.get(commandWord);
    if (!canonicalName) return null; // token pertama tidak cocok registry -> bukan command

    return {
        commandName: canonicalName,
        args: tokens.slice(1)
    };
}

async function handlePrefixMessage(message) {
    // messageCreate.js sudah filter message.author.bot & !message.guild sebelum memanggil ini,
    // tapi kita jaga lagi di sini supaya modul ini aman dipakai standalone.
    if (message.author.bot || !message.guild) return false;

    const parsed = parseMessage(message.content, message.guild?.id);
    if (!parsed) return false; // bukan command -> jangan lakukan apapun (termasuk tidak ada DB write)

    const command = registry.get(parsed.commandName);
    if (!command) return false;

    const denied = require("../src/bot/middleware/accessPolicy.js").accessError(message.author.id, message.guild.id);
    if (denied) {
        await message.reply({ embeds: [createErrorEmbed(denied)] });
        return true;
    }

    // zgame disable <game> — cek per-server sebelum command judi dijalankan.
    if (command.category === "games") {
        const db = require("../utils/database.js");
        const guildData = db.getGuild(message.guild.id);
        if ((guildData.disabledGames || []).includes(parsed.commandName)) {
            await message.reply({ embeds: [createErrorEmbed(`❌ Game **${parsed.commandName}** sedang dinonaktifkan di server ini.`)] }).catch(() => {});
            return true;
        }
    }

    try {
        require("../src/bot/middleware/persistenceBarrier").persistenceBarrier(message, ["reply"]);
        await command.execute(message, parsed.args);
    } catch (err) {
        logger.error(`[COMMAND] Error menjalankan z${parsed.commandName}: ${err.stack || err.message}`);
        await message.reply({ embeds: [createErrorEmbed("Terjadi kesalahan saat menjalankan command ini.")] }).catch(() => {});
    }

    return true;
}

function getRegistry() {
    return registry;
}

module.exports = { loadPrefixCommands, parseMessage, handlePrefixMessage, getRegistry };
