/**
 * ============================================
 *  LOTTERY SERVICE
 *  Virtual currency ONLY. Round di-draw otomatis setiap
 *  pergantian hari (UTC date), pemenang dipilih weighted by tickets.
 * ============================================
 */

const db = require("../../utils/database.js");
const economy = require("./economyService.js");

const TICKET_PRICE = 500;

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Pastikan round hari ini sudah "fresh". Kalau tanggal berubah dan round lama
 * masih punya tiket, lakukan draw otomatis dulu sebelum reset ke round baru.
 */
function ensureRound() {
    const database = db.getDB();
    const today = todayKey();
    if (database.lottery.date === today) return database.lottery;

    const oldRound = database.lottery;
    let lastWinnerId = "";
    let lastPot = 0;

    const entries = Object.entries(oldRound.tickets || {});
    if (oldRound.date && entries.length > 0) {
        const weighted = [];
        for (const [userId, count] of entries) {
            for (let i = 0; i < count; i++) weighted.push(userId);
        }
        const winnerId = weighted[Math.floor(Math.random() * weighted.length)];
        lastPot = oldRound.pot;
        lastWinnerId = winnerId;
        economy.addBalance(winnerId, oldRound.pot);
    }

    database.lottery = { date: today, pot: 0, tickets: {}, lastWinnerId, lastPot };
    db.save();
    return database.lottery;
}

function getRound() {
    return ensureRound();
}

function buyTickets(userId, count) {
    if (!Number.isInteger(count) || count <= 0 || count > 100) {
        return { ok: false, error: "❌ Jumlah tiket harus 1-100." };
    }
    const cost = count * TICKET_PRICE;
    const removed = economy.removeBalance(userId, cost);
    if (!removed) {
        return { ok: false, error: `❌ Saldo tidak cukup. 1 tiket = ${TICKET_PRICE.toLocaleString("id-ID")} coin.` };
    }

    const database = db.getDB();
    ensureRound();
    database.lottery.tickets[userId] = (database.lottery.tickets[userId] || 0) + count;
    database.lottery.pot += cost;
    db.save();

    return { ok: true, cost, round: database.lottery };
}

module.exports = { TICKET_PRICE, ensureRound, getRound, buyTickets };
