/**
 * ============================================
 *  GAME BUTTON HANDLER
 *  Routing customId tombol game (zbj_*, zmines_*) ke controller yang sesuai.
 *  Dipanggil dari handlers/buttonHandler.js — TIDAK menggantikan handler tombol lain.
 * ============================================
 */

const blackjackController = require("../services/game/controllers/blackjackController.js");
const minesController = require("../services/game/controllers/minesController.js");
const highlowController = require("../services/game/controllers/highlowController.js");
const huntController = require("../services/game/controllers/huntController.js");
const marriageController = require("../services/social/marriageController.js");
const logger = require("../utils/logger.js");
const { createErrorEmbed } = require("../utils/embeds.js");

async function handleGameButton(interaction) {
    const id = interaction.customId;

    try {
        if (id.startsWith("zbj_")) {
            // format: zbj_<action>_<gameId>
            const [, action, ...rest] = id.split("_");
            const gameId = rest.join("_");
            return blackjackController.handleButton(interaction, action, gameId);
        }

        if (id.startsWith("zmines_")) {
            // format tile: zmines_tile_<gameId>_<tileIndex>
            // format cashout: zmines_cashout_<gameId>
            const parts = id.split("_");
            const action = parts[1];

            if (action === "tile") {
                const tileIndex = parts[parts.length - 1];
                const gameId = parts.slice(2, parts.length - 1).join("_");
                return minesController.handleButton(interaction, "tile", gameId, tileIndex);
            }

            if (action === "cashout") {
                const gameId = parts.slice(2).join("_");
                return minesController.handleButton(interaction, "cashout", gameId);
            }
        }

        if (id.startsWith("zhl_")) {
            // format: zhl_<higher|lower>_<gameId>
            const [, guess, ...rest] = id.split("_");
            const gameId = rest.join("_");
            return highlowController.handleButton(interaction, guess, gameId);
        }

        if (id.startsWith("zhunt_")) {
            // format: zhunt_<catch|run>_<gameId>
            const [, action, ...rest] = id.split("_");
            const gameId = rest.join("_");
            return huntController.handleButton(interaction, action, gameId);
        }

        if (id.startsWith("zmarry_")) {
            // format: zmarry_<accept|decline>_<proposerId>_<targetId>
            const parts = id.split("_");
            const action = parts[1];
            const proposerId = parts[2];
            const targetId = parts[3];
            return marriageController.handleButton(interaction, action, proposerId, targetId);
        }
    } catch (err) {
        logger.error(`[GAME] gameButtonHandler error: ${err.stack || err.message}`);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ embeds: [createErrorEmbed("Terjadi kesalahan pada game ini.")], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [createErrorEmbed("Terjadi kesalahan pada game ini.")], ephemeral: true }).catch(() => {});
            }
        } catch {
            // interaksi mungkin sudah expired
        }
    }
}

module.exports = { handleGameButton };
