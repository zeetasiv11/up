/**
 * ============================================
 *  SLOTS ENGINE
 *  Weighted probability (bukan random murni 1/6 tiap simbol).
 * ============================================
 */

// Simbol lebih "murah" muncul lebih sering, simbol mahal jarang muncul.
const SYMBOLS = [
    { symbol: "🍒", weight: 35, payoutMultiplier: 2 },
    { symbol: "🍋", weight: 25, payoutMultiplier: 3 },
    { symbol: "🍇", weight: 18, payoutMultiplier: 5 },
    { symbol: "🔔", weight: 12, payoutMultiplier: 8 },
    { symbol: "⭐", weight: 7, payoutMultiplier: 15 },
    { symbol: "💎", weight: 3, payoutMultiplier: 40 }
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

function spinOne() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const entry of SYMBOLS) {
        if (roll < entry.weight) return entry;
        roll -= entry.weight;
    }
    return SYMBOLS[0];
}

/**
 * @param {number} bet
 * @returns {{ reels: string[], payout: number, won: boolean }}
 */
function spin(bet) {
    const results = [spinOne(), spinOne(), spinOne()];
    const reels = results.map((r) => r.symbol);

    let payout = 0;
    if (results[0].symbol === results[1].symbol && results[1].symbol === results[2].symbol) {
        payout = Math.floor(bet * results[0].payoutMultiplier);
    } else if (
        results[0].symbol === results[1].symbol ||
        results[1].symbol === results[2].symbol ||
        results[0].symbol === results[2].symbol
    ) {
        // 2 simbol sama -> payout kecil (setengah dari multiplier simbol yang cocok, minimal 1x)
        const matched = results[0].symbol === results[1].symbol ? results[0] : results[1].symbol === results[2].symbol ? results[1] : results[0];
        payout = Math.floor(bet * Math.max(1, matched.payoutMultiplier / 4));
    }

    return { reels, payout, won: payout > 0 };
}

module.exports = { spin, SYMBOLS };
