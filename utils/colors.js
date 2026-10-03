/**
 * ============================================
 *  COLORS.JS
 *  Helper warna untuk 2 tempat berbeda:
 *
 *  1. Console (terminal) -> pakai ANSI standar, dibaca oleh terminal
 *     tempat "node index.js" dijalankan.
 *
 *  2. Discord message/embed -> Discord Desktop & web mendukung syntax
 *     highlight "ansi" di dalam code block (```ansi ... ```), dengan
 *     subset kode ANSI terbatas: \u001b[{style};{fg}m ... \u001b[0m
 *     Dipakai untuk kartu Blackjack, grid Mines, dan stat box (zcash).
 * ============================================
 */

// ---------- 1. Console colors ----------
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const CONSOLE_FG = {
    gray: "\x1b[90m",
    red: "\x1b[91m",
    green: "\x1b[92m",
    yellow: "\x1b[93m",
    blue: "\x1b[94m",
    magenta: "\x1b[95m",
    cyan: "\x1b[96m",
    white: "\x1b[97m"
};

/**
 * Bungkus teks dengan warna ANSI untuk console.
 * @param {string} text
 * @param {keyof CONSOLE_FG} color
 * @param {{bold?: boolean}} opts
 */
function c(text, color, opts = {}) {
    const code = CONSOLE_FG[color] || "";
    return `${opts.bold ? BOLD : ""}${code}${text}${RESET}`;
}

// ---------- 2. Discord ANSI codeblock colors ----------
const DISCORD_FG = {
    gray: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    pink: 35,
    cyan: 36,
    white: 37
};

/**
 * Bungkus teks dengan warna ANSI yang dikenali Discord (dipakai DI DALAM ```ansi code block).
 * @param {string} text
 * @param {keyof DISCORD_FG} color
 * @param {boolean} bold
 */
function dc(text, color = "white", bold = false) {
    const style = bold ? 1 : 0;
    const code = DISCORD_FG[color] ?? DISCORD_FG.white;
    return `\u001b[${style};${code}m${text}\u001b[0m`;
}

/**
 * Bungkus konten ke dalam code block ber-syntax "ansi" (dirender berwarna oleh Discord Desktop/Web).
 * @param {string} content
 */
function ansiBlock(content) {
    return "```ansi\n" + content + "\n```";
}

module.exports = { c, dc, ansiBlock, RESET, BOLD };
