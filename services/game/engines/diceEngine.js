/**
 * ============================================
 *  DICE ENGINE
 *  Dadu 1-100. Pilihan: high (>50), low (<50), exact (tebak angka 1-100).
 * ============================================
 */

function roll(choice, bet, exactGuess = null) {
    const result = Math.floor(Math.random() * 100) + 1; // 1-100

    let won = false;
    let payout = 0;

    if (choice === "high") {
        won = result > 50;
        payout = won ? Math.floor(bet * 1.9) : 0;
    } else if (choice === "low") {
        won = result < 50;
        payout = won ? Math.floor(bet * 1.9) : 0;
    } else if (choice === "exact") {
        won = result === exactGuess;
        payout = won ? bet * 50 : 0; // odds ~1/100, payout tinggi
    }

    return { result, won, payout };
}

module.exports = { roll };
