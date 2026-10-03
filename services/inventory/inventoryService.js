/**
 * ============================================
 *  INVENTORY SERVICE
 *  Item disimpan sebagai map { itemId: qty } di user.inventory
 *  agar konsisten dipakai slash & text command.
 * ============================================
 */

const db = require("../../utils/database.js");
const { getItem } = require("../../data/items.js");

function getInventory(userId) {
    const user = db.getUser(userId);
    return user.inventory || {};
}

function getQty(userId, itemId) {
    const inv = getInventory(userId);
    return inv[itemId] || 0;
}

function addItem(userId, itemId, qty = 1) {
    if (!getItem(itemId) || !Number.isFinite(qty) || qty <= 0) return getQty(userId, itemId);
    const inv = getInventory(userId);
    inv[itemId] = (inv[itemId] || 0) + Math.floor(qty);
    db.updateUser(userId, { inventory: inv });
    return inv[itemId];
}

/**
 * @returns {boolean} true jika berhasil dikurangi (stok cukup)
 */
function removeItem(userId, itemId, qty = 1) {
    if (!Number.isFinite(qty) || qty <= 0) return false;
    const inv = getInventory(userId);
    if ((inv[itemId] || 0) < qty) return false;
    inv[itemId] -= qty;
    if (inv[itemId] <= 0) delete inv[itemId];
    db.updateUser(userId, { inventory: inv });
    return true;
}

function hasItem(userId, itemId, qty = 1) {
    return getQty(userId, itemId) >= qty;
}

module.exports = { getInventory, getQty, addItem, removeItem, hasItem };
