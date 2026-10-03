/**
 * ============================================
 *  BANNER.JS
 *  Tampilan console saat "node index.js" dijalankan.
 * ============================================
 */

const { c } = require("./colors.js");

const WIDTH = 44;

function centered(text) {
    const pad = Math.max(0, WIDTH - text.length);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return " ".repeat(left) + text + " ".repeat(right);
}

function printBanner() {
    const border = "═".repeat(WIDTH);
    const divider = "─".repeat(WIDTH);

    console.log("");
    console.log(c(`╔${border}╗`, "cyan", { bold: true }));
    console.log(c("║", "cyan", { bold: true }) + c(centered("ZEECHEIV2 BARU"), "magenta", { bold: true }) + c("║", "cyan", { bold: true }));
    console.log(c(`╟${divider}╢`, "cyan"));
    console.log(c("║", "cyan", { bold: true }) + c(centered("credit by zeetasi"), "cyan") + c("║", "cyan", { bold: true }));
    console.log(c(`╚${border}╝`, "cyan", { bold: true }));
    console.log("");
}

module.exports = { printBanner };
