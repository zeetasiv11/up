/**
 * ============================================
 *  HIGH-LOW ENGINE
 *  Kartu bernilai 1-13 (mirip nilai kartu As-King).
 * ============================================
 */

function drawCard() {
    return Math.floor(Math.random() * 13) + 1;
}

/**
 * @param {number} current
 * @param {number} next
 * @param {"higher"|"lower"} guess
 */
function evaluate(current, next, guess) {
    if (next === current) return "push"; // seri -> uang kembali
    const actual = next > current ? "higher" : "lower";
    return actual === guess ? "win" : "lose";
}

module.exports = { drawCard, evaluate };
