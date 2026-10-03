/**
 * ============================================
 *  BLACKJACK ENGINE
 *  Implementasi rules Blackjack yang sesungguhnya (bukan mockup).
 * ============================================
 */

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(card) {
    if (card.rank === "A") return 11;
    if (card.rank === "J" || card.rank === "Q" || card.rank === "K") return 10;
    return parseInt(card.rank, 10);
}

function handValue(hand) {
    let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
    let aces = hand.filter((c) => c.rank === "A").length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function isBust(hand) {
    return handValue(hand) > 21;
}

function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand) === 21;
}

function formatCard(card) {
    return `\`${card.rank}${card.suit}\``;
}

function formatHand(hand, hideFirst = false) {
    return hand.map((c, i) => (hideFirst && i === 0 ? "🂠" : formatCard(c))).join(" ");
}

// ============================================
//  KARTU ASCII + WARNA (v2)
//  Dirender di dalam ```ansi code block agar tampil seperti kartu asli
//  (kotak, rank pojok kiri-atas & kanan-bawah, suit di tengah, merah/putih).
// ============================================
const { dc } = require("../../../utils/colors.js");

const RED_SUITS = new Set(["♥", "♦"]);

function suitColor(suit) {
    return RED_SUITS.has(suit) ? "red" : "white";
}

/**
 * Render satu kartu jadi 5 baris ascii-box (tertutup jika hidden=true).
 * @returns {string[]} 5 baris teks (semua sama panjang visualnya)
 */
function cardBoxLines(card, hidden = false) {
    if (hidden) {
        const back = dc("░░░░", "blue", true);
        return ["┌────┐", `│${back}│`, `│${back}│`, `│${back}│`, "└────┘"];
    }
    const color = suitColor(card.suit);
    const top = dc(card.rank.padEnd(4, " "), color, true);
    const mid = dc(` ${card.suit}  `, color, true);
    const bot = dc(card.rank.padStart(4, " "), color, true);
    return ["┌────┐", `│${top}│`, `│${mid}│`, `│${bot}│`, "└────┘"];
}

/**
 * Render satu tangan (array kartu) berjajar horizontal sebagai ascii-box.
 * @param {Array} hand
 * @param {Set<number>} hiddenIndices - index kartu yang masih ditutup (belum dibuka)
 */
function renderHandAscii(hand, hiddenIndices = new Set()) {
    const blocks = hand.map((card, i) => cardBoxLines(card, hiddenIndices.has(i)));
    const rows = [];
    for (let r = 0; r < 5; r++) {
        rows.push(blocks.map((b) => b[r]).join(" "));
    }
    return rows.join("\n");
}

function dealerPlay(deck, dealerHand) {
    // Dealer wajib hit sampai >= 17 (standard rule)
    while (handValue(dealerHand) < 17) {
        dealerHand.push(deck.pop());
    }
    return dealerHand;
}

module.exports = { createDeck, cardValue, handValue, isBust, isBlackjack, formatHand, renderHandAscii, dealerPlay };
