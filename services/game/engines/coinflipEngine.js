/**
 * ============================================
 *  COINFLIP ENGINE
 * ============================================
 */

const PAYOUT_MULTIPLIER = 1.9; // sedikit house edge (bukan 2x flat)

function flip(choice, bet) {
    const result = Math.random() < 0.5 ? "heads" : "tails";
    const won = result === choice;
    const payout = won ? Math.floor(bet * PAYOUT_MULTIPLIER) : 0;
    return { result, won, payout };
}

module.exports = { flip, PAYOUT_MULTIPLIER };
