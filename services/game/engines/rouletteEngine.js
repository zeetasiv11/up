/**
 * ============================================
 *  ROULETTE ENGINE
 *  Virtual currency ONLY — no cash-out ke uang asli.
 * ============================================
 */

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function colorOf(number) {
    if (number === 0) return "green";
    return RED_NUMBERS.has(number) ? "red" : "black";
}

/**
 * @param {"red"|"black"|"green"|number} bet
 */
function spin(bet, wager) {
    const number = Math.floor(Math.random() * 37); // 0-36
    const color = colorOf(number);

    let won = false;
    let payout = 0;

    if (bet === "red" || bet === "black") {
        won = bet === color;
        payout = won ? wager * 2 : 0;
    } else if (bet === "green") {
        won = color === "green";
        payout = won ? wager * 14 : 0;
    } else if (typeof bet === "number") {
        won = bet === number;
        payout = won ? wager * 36 : 0;
    }

    return { number, color, won, payout };
}

module.exports = { spin, colorOf };
