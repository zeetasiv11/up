/**
 * ============================================
 *  HIGH-LOW CONTROLLER
 *  Single-round: kartu sekarang ditampilkan, user tebak HIGHER/LOWER
 *  via button. Escrow bet sudah dipotong sebelum session dibuat.
 * ============================================
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const settings = require("../../../settings.js");
const economy = require("../../economy/economyService.js");
const stats = require("../../economy/statsService.js");
const sessionManager = require("../sessionManager.js");
const highlowEngine = require("../engines/highlowEngine.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const TIMEOUT_MS = 30 * 1000;

function buildRow(gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`zhl_higher_${gameId}`).setLabel("⬆️ HIGHER").setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`zhl_lower_${gameId}`).setLabel("⬇️ LOWER").setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );
}

async function startGame(message, userId, bet) {
    const current = highlowEngine.drawCard();
    const session = sessionManager.createSession(
        "highlow",
        userId,
        { bet, current },
        TIMEOUT_MS,
        onTimeout
    );

    if (!session) {
        return { ok: false, error: "❌ Kamu masih punya game HighLow yang berjalan." };
    }

    const embed = createInfoEmbed(`Kartu sekarang: **${current}**\n\nBet: **${bet.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}\n\nTebak kartu berikutnya lebih tinggi atau lebih rendah?`, "🔢 HIGH LOW");
    await sessionManager.bindMessage(session, await message.reply({ embeds: [embed], components: [buildRow(session.id)] }));
    return { ok: true, session };
}

async function handleButton(interaction, guess, gameId) {
    const session = sessionManager.getSession(gameId);
    if (!session) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ This game has already ended.")], ephemeral: true });
    }
    if (interaction.user.id !== session.ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ This game belongs to another player.")], ephemeral: true });
    }

    sessionManager.endSession(gameId);

    const { bet, current } = session.data;
    const next = highlowEngine.drawCard();
    const outcome = highlowEngine.evaluate(current, next, guess);

    let payout = 0;
    let won = false;
    if (outcome === "push") {
        economy.addBalance(session.ownerId, bet); // uang kembali, tidak dihitung win/loss
        await interaction.update({
            embeds: [createInfoEmbed(`Kartu sebelumnya: **${current}** → Kartu baru: **${next}**\n\nSeri! Bet kamu dikembalikan.`, "🔢 HIGH LOW")],
            components: [buildRow(gameId, true)]
        });
        return;
    }

    won = outcome === "win";
    payout = won ? Math.floor(bet * 1.9) : 0;
    if (won) economy.addBalance(session.ownerId, payout);
    stats.recordGameResult(session.ownerId, { won, wager: bet });
    logger.game(`HighLow ${session.ownerId} current=${current} next=${next} guess=${guess} won=${won}`);

    const description = won
        ? `Kartu sebelumnya: **${current}** → Kartu baru: **${next}**\n\nTebakanmu **BENAR**! Kamu menang **${payout.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`
        : `Kartu sebelumnya: **${current}** → Kartu baru: **${next}**\n\nTebakanmu salah. Kamu kalah **${bet.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}.`;

    await interaction.update({
        embeds: [won ? createSuccessEmbed(description, "🔢 HIGH LOW") : createInfoEmbed(description, "🔢 HIGH LOW")],
        components: [buildRow(gameId, true)]
    });
}

async function onTimeout(session) {
    if (!sessionManager.endSession(session.id)) return;
    economy.addBalance(session.ownerId, session.data.bet);
    await session.message?.edit({content:"HighLow expired. Your bet was returned.",components:[]}).catch(()=>{});
}
module.exports = { startGame, handleButton, onTimeout };
