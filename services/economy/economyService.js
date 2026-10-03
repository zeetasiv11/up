/**
 * ============================================
 *  ECONOMY SERVICE
 *  Logic ekonomi terpusat — dipakai oleh slash command
 *  MAUPUN text command (zcash, zbank, dst) agar tidak ada
 *  database/logic yang terpisah/duplikat.
 * ============================================
 */

const db = require("../../utils/database.js");
const logger = require("../../utils/logger.js");

function getEconomy(userId) {
    const user = db.getUser(userId);
    return { balance: user.balance || 0, bank: user.bank || 0 };
}

function hasBalance(userId, amount) {
    const user = db.getUser(userId);
    return (user.balance || 0) >= amount;
}

function addBalance(userId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return getEconomy(userId).balance;
    const user = db.getUser(userId);
    const newBalance = (user.balance || 0) + Math.floor(amount);
    if (!Number.isSafeInteger(newBalance)) throw new RangeError("Batas saldo tercapai");
    db.updateUser(userId, { balance: newBalance });
    return newBalance;
}

/**
 * Mengurangi balance. Mengembalikan false jika saldo tidak cukup
 * (tidak pernah membuat balance menjadi negatif).
 */
function removeBalance(userId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    const user = db.getUser(userId);
    if ((user.balance || 0) < amount) return false;
    db.updateUser(userId, { balance: user.balance - Math.floor(amount) });
    return true;
}

function deposit(userId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "Jumlah tidak valid." };
    const user = db.getUser(userId);
    if ((user.balance || 0) < amount) {
        return { ok: false, error: "❌ Saldo cash kamu tidak cukup untuk deposit sejumlah ini." };
    }
    if (!Number.isSafeInteger((user.bank || 0) + amount)) return { ok: false, error: "Batas saldo tercapai." };
    db.updateUser(userId, { balance: user.balance - amount, bank: (user.bank || 0) + amount });
    logger.economy(`${userId} deposit ${amount}`);
    return { ok: true };
}

function withdraw(userId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "Jumlah tidak valid." };
    const user = db.getUser(userId);
    if ((user.bank || 0) < amount) {
        return { ok: false, error: "❌ Your bank does not have enough coins to withdraw this amount." };
    }
    if (!Number.isSafeInteger((user.balance || 0) + amount)) return { ok: false, error: "Batas saldo tercapai." };
    db.updateUser(userId, { bank: user.bank - amount, balance: (user.balance || 0) + amount });
    logger.economy(`${userId} withdraw ${amount}`);
    return { ok: true };
}

function transfer(fromId, toId, amount) {
    if (fromId === toId) return { ok: false, error: "❌ Kamu tidak bisa transfer coin ke dirimu sendiri." };
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "❌ Jumlah transfer tidak valid." };

    const sender = db.getUser(fromId);
    if ((sender.balance || 0) < amount) return { ok: false, error: "❌ Saldo kamu tidak cukup." };

    const receiver = db.getUser(toId);
    if (!Number.isSafeInteger(receiver.balance + amount)) return { ok: false, error: "Batas saldo tercapai." };
    db.updateUsers({
        [fromId]: { balance: sender.balance - amount },
        [toId]: { balance: receiver.balance + amount }
    });
    logger.economy(`${fromId} -> ${toId} : ${amount}`);
    return { ok: true };
}

module.exports = {
    getEconomy,
    hasBalance,
    addBalance,
    removeBalance,
    deposit,
    withdraw,
    transfer
};
