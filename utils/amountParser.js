/**
 * ============================================
 *  AMOUNT PARSER
 *  Parser universal untuk input jumlah coin.
 *  Mendukung: 1000, 1k, 2.5k, 100k, 1m, 2.5m, 1b, all, half
 *  Menolak: NaN, Infinity, negative, 0, format aneh
 * ============================================
 */

const SUFFIXES = { k: 1e3, m: 1e6, b: 1e9 };
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/**
 * @param {string} input - raw text dari user, misal "2.5m", "all", "half"
 * @param {number} available - saldo yang tersedia, dipakai untuk "all" / "half"
 * @param {{ maxAllAmount?: number }} [options] - opsi tambahan.
 *        maxAllAmount: kalau diisi (>0), input "all" akan di-cap ke angka ini
 *        (tidak langsung all-in saldo penuh) — dipakai oleh game gambling.
 * @returns {{ ok: true, amount: number } | { ok: false, error: string }}
 */
function parseAmount(input, available = 0, options = {}) {
    if (input === undefined || input === null || String(input).trim() === "") {
        return { ok: false, error: "❌ Silakan masukkan jumlah yang valid." };
    }

    const raw = String(input).trim().toLowerCase();
    const maxAllAmount = options.maxAllAmount;

    if (raw === "all") {
        let amount = Math.floor(available);
        if (Number.isFinite(maxAllAmount) && maxAllAmount > 0) {
            amount = Math.min(amount, Math.floor(maxAllAmount));
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return { ok: false, error: "❌ Saldo kamu tidak mencukupi." };
        }
        return { ok: true, amount };
    }

    if (raw === "half") {
        const amount = Math.floor(available / 2);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { ok: false, error: "❌ Saldo kamu tidak mencukupi." };
        }
        return { ok: true, amount };
    }

    const match = raw.match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
    if (!match) {
        return { ok: false, error: "❌ Format jumlah tidak valid. Contoh: `1000`, `1k`, `2.5m`, `all`, `half`." };
    }

    const numberPart = parseFloat(match[1]);
    const suffix = match[2];

    if (!Number.isFinite(numberPart) || numberPart < 0) {
        return { ok: false, error: "❌ Jumlah tidak valid." };
    }

    const multiplier = suffix ? SUFFIXES[suffix] : 1;
    const amount = Math.floor(numberPart * multiplier);

    if (!Number.isFinite(amount) || Number.isNaN(amount)) {
        return { ok: false, error: "❌ Jumlah tidak valid." };
    }
    if (amount <= 0) {
        return { ok: false, error: "❌ Jumlah harus lebih besar dari 0." };
    }
    if (amount > MAX_SAFE) {
        return { ok: false, error: "❌ Jumlah terlalu besar." };
    }

    return { ok: true, amount };
}

module.exports = { parseAmount };
