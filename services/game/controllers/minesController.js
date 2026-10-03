/**
 * ============================================
 *  MINES CONTROLLER (v2)
 *  Satu-satunya tempat logic Mines berjalan.
 *
 *  v2: tile terakhir dibuka disorot beda warna, panel statistik pakai
 *  ansi codeblock, dan tiap klik tile ada animasi flip singkat sebelum
 *  hasil (aman/mine) ditampilkan.
 * ============================================
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const settings = require("../../../settings.js");
const economy = require("../../economy/economyService.js");
const stats = require("../../economy/statsService.js");
const sessionManager = require("../sessionManager.js");
const engine = require("../engines/minesEngine.js");
const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const { ansiBlock, dc } = require("../../../utils/colors.js");
const { sleep } = require("../../../utils/sleep.js");
const logger = require("../../../utils/logger.js");

const GAME_TYPE = "mines";
const TIMEOUT_MS = 5 * 60 * 1000; // 5 menit
const FLIP_DELAY_MS = 450;

function fmt(n) {
    return Math.floor(n).toLocaleString("id-ID");
}

function statLine(label, value, color) {
    return `${label.padEnd(10, " ")}: ${dc(value, color, true)}`;
}

function buildEmbed(session, { resultText = null, showAll = false } = {}) {
    const { size, mines, revealed, bet, safeOpened, lastIndex } = session.data;
    const multiplier = engine.calculateMultiplier(size, mines.size, safeOpened);
    const potential = Math.floor(bet * multiplier);

    const grid = engine.renderGrid(size, revealed, mines, showAll, lastIndex);
    const statsBlock = [
        statLine("Bet", `${fmt(bet)} ${settings.economy.currencyIcon}`, "yellow"),
        statLine("Tile Aman", `${safeOpened}`, "cyan"),
        statLine("Multiplier", `${multiplier.toFixed(2)}x`, "green"),
        statLine("Cash Out", `${fmt(potential)} ${settings.economy.currencyIcon}`, "green")
    ].join("\n");

    let description = `${grid}\n\n${ansiBlock(statsBlock)}`;
    if (resultText) description += `\n${resultText}`;

    return createInfoEmbed(description, "💣 MINES");
}

/**
 * @param {object} session
 * @param {boolean} disabled - kunci SEMUA tombol (dipakai saat animasi flip / game berakhir)
 * @param {number|null} pendingIdx - index tile yang sedang dalam animasi "membuka" (tampil ❔)
 */
function buildButtons(session, disabled = false, pendingIdx = null) {
    const { size, revealed, mines } = session.data;
    const rows = [];
    for (let r = 0; r < size / 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 4; c++) {
            const idx = r * 4 + c;
            const isRevealed = revealed.has(idx);
            const isPending = idx === pendingIdx;

            // PENTING: label tombol Discord TIDAK BOLEH cuma whitespace (" ") — akan ditolak
            // API dan bikin interaction gagal di-ack ("didn't respond in time"). Selalu pakai
            // karakter/emoji yang jelas.
            let label = "⬜";
            let style = ButtonStyle.Primary;
            if (isPending) {
                label = "❔";
                style = ButtonStyle.Secondary;
            } else if (isRevealed) {
                label = mines.has(idx) ? "💣" : "💎";
                style = mines.has(idx) ? ButtonStyle.Danger : ButtonStyle.Success;
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`zmines_tile_${session.id}_${idx}`)
                    .setLabel(label)
                    .setStyle(style)
                    .setDisabled(disabled || isRevealed || isPending)
            );
        }
        rows.push(row);
    }
    // Baris terakhir: tombol Cash Out
    const cashoutRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`zmines_cashout_${session.id}`)
            .setLabel("CASH OUT")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled || session.data.safeOpened === 0 || pendingIdx !== null)
    );
    rows.push(cashoutRow);
    return rows;
}

async function safeEdit(session, payload) {
    if (!session.message) return;
    await sessionManager.checkpoint(session);
    await session.message.edit(payload).catch(() => {});
}

async function settle(session, { won, payout, resultText, showAll = true }) {
    if (!sessionManager.endSession(session.id)) return;

    if (won && payout > 0) {
        economy.addBalance(session.ownerId, payout);
    }
    stats.recordGameResult(session.ownerId, { won, wager: session.data.bet });
    logger.game(`Mines ${session.ownerId} won=${won} payout=${payout || 0}`);

    const embed = buildEmbed(session, { resultText, showAll });
    await safeEdit(session, { embeds: [embed], components: buildButtons(session, true) });
}

async function onTimeout(session) {
    // Timeout: game dianggap berakhir tanpa cash out -> taruhan hangus (mencegah reward ganda / stalling).
    await settle(session, { won: false, payout: 0, resultText: "⏱️ Waktu habis! Game berakhir tanpa cash out." });
}

async function startGame(message, ownerId, bet, mineCount) {
    const { size, mineCount: finalMineCount, mines } = engine.generateGrid(engine.GRID_SIZE, mineCount);

    const session = sessionManager.createSession(
        GAME_TYPE,
        ownerId,
        { size, mines, mineCount: finalMineCount, revealed: new Set(), bet, safeOpened: 0, lastIndex: null },
        TIMEOUT_MS,
        onTimeout
    );

    if (!session) {
        return { ok: false, error: "❌ Kamu masih memiliki game Mines yang sedang berjalan." };
    }

    const sentMsg = await message.reply({ embeds: [buildEmbed(session)], components: buildButtons(session) });
    await sessionManager.bindMessage(session, sentMsg);
    return { ok: true };
}

async function handleButtonUnlocked(interaction, action, gameId, tileIndex) {
    const session = sessionManager.getSession(gameId);

    if (!session) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Game ini sudah berakhir.")], ephemeral: true });
    }
    if (interaction.user.id !== session.ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Game ini milik pemain lain.")], ephemeral: true });
    }

    if (action === "cashout") {
        if (session.data.safeOpened === 0) {
            return interaction.reply({ embeds: [createErrorEmbed("❌ Buka minimal 1 tile aman sebelum cash out.")], ephemeral: true });
        }
        const multiplier = engine.calculateMultiplier(session.data.size, session.data.mines.size, session.data.safeOpened);
        const payout = Math.floor(session.data.bet * multiplier);
        await sessionManager.checkpoint(session);
        await interaction.update({ embeds: [buildEmbed(session)], components: buildButtons(session, true) });
        return settle(session, { won: true, payout, resultText: `💰 Cash out berhasil! Kamu mendapat **${fmt(payout)}** ${settings.economy.currencyIcon}` });
    }

    if (action === "tile") {
        const idx = Number(tileIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= session.data.size || session.data.revealed.has(idx)) {
            return interaction.reply({ embeds: [createErrorEmbed("❌ Tile ini sudah dibuka.")], ephemeral: true });
        }

        // --- animasi flip: ack cepat dengan tile ini menampilkan "❔" (semua tombol dikunci sesaat) ---
        await sessionManager.checkpoint(session);
        await interaction.update({ embeds: [buildEmbed(session)], components: buildButtons(session, true, idx) });
        await sleep(FLIP_DELAY_MS);

        session.data.revealed.add(idx);

        if (session.data.mines.has(idx)) {
            await safeEdit(session, { embeds: [buildEmbed(session, { showAll: true })], components: buildButtons(session, true) });
            return settle(session, { won: false, payout: 0, resultText: "💥 Kamu menginjak mine! Taruhan hangus.", showAll: true });
        }

        session.data.safeOpened += 1;
        session.data.lastIndex = idx;

        // Menang otomatis jika semua tile aman sudah dibuka
        const safeTiles = session.data.size - session.data.mineCount;
        if (session.data.safeOpened >= safeTiles) {
            const multiplier = engine.calculateMultiplier(session.data.size, session.data.mines.size, session.data.safeOpened);
            const payout = Math.floor(session.data.bet * multiplier);
            await safeEdit(session, { embeds: [buildEmbed(session, { showAll: true })], components: buildButtons(session, true) });
            return settle(session, { won: true, payout, resultText: `🏆 Semua tile aman terbuka! Kamu mendapat **${fmt(payout)}** ${settings.economy.currencyIcon}`, showAll: true });
        }

        await safeEdit(session, { embeds: [buildEmbed(session)], components: buildButtons(session) });
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
