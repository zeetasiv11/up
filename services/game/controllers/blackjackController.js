/**
 * ============================================
 *  BLACKJACK CONTROLLER (v2)
 *  Satu-satunya tempat logic Blackjack berjalan.
 *  Dipakai oleh commands/prefix/games/blackjack.js (start game)
 *  DAN handlers/gameButtonHandler.js (hit/stand/double),
 *  supaya tidak ada logic ganda.
 *
 *  v2: kartu dirender sebagai ascii-box berwarna (ansi codeblock) +
 *  animasi "buka kartu" bertahap (dealing / hit / dealer play).
 * ============================================
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const settings = require("../../../settings.js");
const economy = require("../../economy/economyService.js");
const stats = require("../../economy/statsService.js");
const sessionManager = require("../sessionManager.js");
const engine = require("../engines/blackjackEngine.js");
const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const { ansiBlock, dc } = require("../../../utils/colors.js");
const { sleep } = require("../../../utils/sleep.js");
const logger = require("../../../utils/logger.js");

const GAME_TYPE = "blackjack";
const TIMEOUT_MS = 90 * 1000;
const FLIP_DELAY_MS = 550; // jeda antar frame animasi buka kartu

function fmt(n) {
    return n.toLocaleString("id-ID");
}

function currentBet(session) {
    return session.data.doubled ? session.data.bet * 2 : session.data.bet;
}

/**
 * Membangun embed. `dealerHidden`/`playerHidden` adalah Set index kartu yang
 * masih tertutup (dipakai untuk animasi buka kartu bertahap). Jika tidak
 * diisi, default: dealer kartu ke-0 tertutup (kecuali reveal=true), player
 * selalu terbuka semua.
 */
function buildEmbed(session, { reveal = false, resultText = null, dealerHidden = null, playerHidden = null } = {}) {
    const { dealerHand, playerHand } = session.data;
    const dealerHiddenIdx = dealerHidden ?? (reveal ? new Set() : new Set([0]));
    const playerHiddenIdx = playerHidden ?? new Set();

    const dealerValueTxt = dealerHiddenIdx.size > 0 ? "?" : engine.handValue(dealerHand);
    const playerValueTxt = playerHiddenIdx.size > 0 ? "?" : engine.handValue(playerHand);

    const cardsBlock =
        `${dc("DEALER", "cyan", true)}  ${dc(`[ ${dealerValueTxt} ]`, "gray")}\n` +
        `${engine.renderHandAscii(dealerHand, dealerHiddenIdx)}\n\n` +
        `${dc(session.playerName.toUpperCase(), "yellow", true)}  ${dc(`[ ${playerValueTxt} ]`, "gray")}\n` +
        `${engine.renderHandAscii(playerHand, playerHiddenIdx)}`;

    let description = ansiBlock(cardsBlock) + `\nBet: **${fmt(currentBet(session))}** ${settings.economy.currencyIcon}`;
    if (resultText) description += `\n\n${resultText}`;

    return createInfoEmbed(description, "🃏 BLACKJACK");
}

function buildButtons(gameId, { disabled = false, canDouble = true } = {}) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`zbj_hit_${gameId}`).setLabel("HIT").setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`zbj_stand_${gameId}`).setLabel("STAND").setStyle(ButtonStyle.Danger).setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`zbj_double_${gameId}`)
            .setLabel("DOUBLE")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || !canDouble)
    );
}

async function safeEdit(session, payload) {
    if (!session.message) return;
    await sessionManager.checkpoint(session);
    await session.message.edit(payload).catch(() => {});
}

/**
 * Menyelesaikan game: menghitung hasil, membayar/mencatat, dan mengedit pesan.
 * Dealer HARUS sudah selesai bermain (dealerHand final) sebelum fungsi ini dipanggil.
 */
async function settle(session, outcome) {
    if (!sessionManager.endSession(session.id)) return;

    const total = currentBet(session);
    let resultText;
    let won = false;

    if (outcome === "blackjack") {
        const payout = Math.floor(total * 2.5);
        economy.addBalance(session.ownerId, payout);
        won = true;
        resultText = `🎉 **BLACKJACK!** Kamu menang **${fmt(payout)}** ${settings.economy.currencyIcon}`;
    } else if (outcome === "win") {
        const payout = total * 2;
        economy.addBalance(session.ownerId, payout);
        won = true;
        resultText = `🎉 Kamu menang **${fmt(payout)}** ${settings.economy.currencyIcon}`;
    } else if (outcome === "push") {
        economy.addBalance(session.ownerId, total);
        resultText = `🤝 Push! Taruhan **${fmt(total)}** ${settings.economy.currencyIcon} dikembalikan.`;
    } else {
        resultText = `❌ Kamu kalah **${fmt(total)}** ${settings.economy.currencyIcon}`;
    }

    stats.recordGameResult(session.ownerId, { won, wager: total });
    logger.game(`Blackjack ${session.ownerId} outcome=${outcome} bet=${total}`);

    const embed = buildEmbed(session, { reveal: true, resultText });
    const components = [buildButtons(session.id, { disabled: true })];
    await safeEdit(session, { embeds: [embed], components });
}

/**
 * Memainkan giliran dealer dengan animasi (buka kartu tertutup, lalu hit satu-per-satu sampai >= 17).
 */
async function playDealerAnimated(session) {
    await safeEdit(session, {
        embeds: [buildEmbed(session, { dealerHidden: new Set(), playerHidden: new Set() })],
        components: [buildButtons(session.id, { disabled: true })]
    });
    await sleep(FLIP_DELAY_MS);

    while (engine.handValue(session.data.dealerHand) < 17) {
        session.data.dealerHand.push(session.data.deck.pop());
        await safeEdit(session, {
            embeds: [buildEmbed(session, { dealerHidden: new Set(), playerHidden: new Set() })],
            components: [buildButtons(session.id, { disabled: true })]
        });
        await sleep(FLIP_DELAY_MS);
    }
}

async function resolveStand(session) {
    await playDealerAnimated(session);

    const playerValue = engine.handValue(session.data.playerHand);
    const dealerValue = engine.handValue(session.data.dealerHand);

    let outcome;
    if (dealerValue > 21) outcome = "win";
    else if (playerValue > dealerValue) outcome = "win";
    else if (playerValue === dealerValue) outcome = "push";
    else outcome = "lose";

    return settle(session, outcome);
}

async function onTimeout(session) {
    // Timeout dianggap otomatis STAND (dealer bermain sesuai state saat ini), bukan reward ganda.
    await resolveStand(session);
}

/**
 * Memulai game Blackjack baru. Bet sudah divalidasi & diambil (escrow) oleh caller SEBELUM memanggil ini.
 */
async function startGame(message, ownerId, bet) {
    const deck = engine.createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const session = sessionManager.createSession(GAME_TYPE, ownerId, { deck, playerHand, dealerHand, bet, doubled: false }, TIMEOUT_MS, onTimeout);

    if (!session) {
        // Gagal buat sesi (user sudah punya game aktif) -> refund escrow ke caller yang menangani
        return { ok: false, error: "❌ Kamu masih memiliki game Blackjack yang sedang berjalan." };
    }

    session.playerName = message.author.username;

    // --- Frame 0: semua kartu tertutup ("mengocok...") ---
    const sentMsg = await message.reply({
        embeds: [buildEmbed(session, { dealerHidden: new Set([0, 1]), playerHidden: new Set([0, 1]) })],
        components: [buildButtons(session.id, { disabled: true })]
    });
    await sessionManager.bindMessage(session, sentMsg);

    // --- Frame 1: kartu player ke-1 dibuka ---
    await sleep(FLIP_DELAY_MS);
    await safeEdit(session, { embeds: [buildEmbed(session, { dealerHidden: new Set([0, 1]), playerHidden: new Set([1]) })] });

    // --- Frame 2: kartu player ke-2 dibuka ---
    await sleep(FLIP_DELAY_MS);
    await safeEdit(session, { embeds: [buildEmbed(session, { dealerHidden: new Set([0, 1]), playerHidden: new Set() })] });

    // --- Frame 3: kartu "up-card" dealer dibuka (kartu ke-2 dealer tetap tertutup) ---
    await sleep(FLIP_DELAY_MS);
    const blackjack = engine.isBlackjack(playerHand);
    const finalDealerHidden = blackjack ? new Set() : new Set([0]);
    await safeEdit(session, {
        embeds: [buildEmbed(session, { dealerHidden: finalDealerHidden, playerHidden: new Set() })],
        components: [buildButtons(session.id, { disabled: blackjack, canDouble: true })]
    });

    if (blackjack) {
        await settle(session, "blackjack");
    }

    return { ok: true };
}

/**
 * Menangani interaksi tombol HIT / STAND / DOUBLE.
 */
async function handleButtonUnlocked(interaction, action, gameId) {
    const session = sessionManager.getSession(gameId);

    if (!session) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Game ini sudah berakhir.")], ephemeral: true });
    }
    if (interaction.user.id !== session.ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Game ini milik pemain lain.")], ephemeral: true });
    }

    if (action === "hit") {
        session.data.playerHand.push(session.data.deck.pop());
        const newIdx = session.data.playerHand.length - 1;

        // Ack cepat (wajib) dengan kartu baru masih tertutup -> efek "buka kartu"
        await sessionManager.checkpoint(session);
        await interaction.update({
            embeds: [buildEmbed(session, { playerHidden: new Set([newIdx]) })],
            components: [buildButtons(session.id, { disabled: true })]
        });
        await sleep(FLIP_DELAY_MS);

        if (engine.isBust(session.data.playerHand)) {
            await safeEdit(session, { embeds: [buildEmbed(session)], components: [buildButtons(session.id, { disabled: true })] });
            return settle(session, "lose");
        }

        await safeEdit(session, {
            embeds: [buildEmbed(session)],
            components: [buildButtons(session.id, { canDouble: false })]
        });
        return;
    }

    if (action === "stand") {
        await sessionManager.checkpoint(session);
        await interaction.update({ embeds: [buildEmbed(session)], components: [buildButtons(session.id, { disabled: true })] });
        return resolveStand(session);
    }

    if (action === "double") {
        if (session.data.doubled || session.data.playerHand.length !== 2) {
            return interaction.reply({ embeds: [createErrorEmbed("❌ Kamu hanya bisa double di giliran pertama.")], ephemeral: true });
        }
        if (!economy.hasBalance(session.ownerId, session.data.bet)) {
            return interaction.reply({ embeds: [createErrorEmbed("❌ Saldo kamu tidak cukup untuk double.")], ephemeral: true });
        }
        session.data.doubled = true;
        const user = require("../../../utils/database").getUser(session.ownerId);
        // Include the double-down flag and second escrow debit in one snapshot.
        user.balance -= session.data.bet;
        session.data.playerHand.push(session.data.deck.pop());
        const newIdx = session.data.playerHand.length - 1;

        await sessionManager.checkpoint(session);
        await interaction.update({
            embeds: [buildEmbed(session, { playerHidden: new Set([newIdx]) })],
            components: [buildButtons(session.id, { disabled: true })]
        });
        await sleep(FLIP_DELAY_MS);

        if (engine.isBust(session.data.playerHand)) {
            await safeEdit(session, { embeds: [buildEmbed(session)], components: [buildButtons(session.id, { disabled: true })] });
            return settle(session, "lose");
        }

        await safeEdit(session, { embeds: [buildEmbed(session)], components: [buildButtons(session.id, { disabled: true })] });
        return resolveStand(session);
    }
}

async function handleButton(interaction, action, gameId, tileIndex) {
    const active = sessionManager.getSession(gameId);
    if (active && interaction.message) active.message = interaction.message;
    const handled = await sessionManager.withAction(gameId, interaction.user.id,
        () => handleButtonUnlocked(interaction, action, gameId, tileIndex));
    if (!handled) await interaction.reply({
        embeds: [createErrorEmbed("Game sedang diproses, sudah berakhir, atau bukan milikmu.")], ephemeral: true
    });
}

module.exports = { startGame, handleButton, onTimeout };
