/**
 * ============================================
 *  MINES ENGINE
 *  Grid 4x4 (16 tile), 4 mines secara default.
 *  Multiplier naik setiap tile aman berhasil dibuka.
 * ============================================
 */

const GRID_SIZE = 16; // 4x4
const MINE_COUNT = 4;
const HOUSE_EDGE = 0.97; // sedikit house edge supaya payout tidak "murni" fair (mencegah exploit EV positif)

function generateGrid(size = GRID_SIZE, mineCount = MINE_COUNT) {
    const positions = Array.from({ length: size }, (_, i) => i);
    // Fisher-Yates untuk memilih posisi mine secara acak
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const mines = new Set(positions.slice(0, mineCount));
    return { size, mineCount, mines };
}

/**
 * Multiplier fair-odds untuk n tile aman yang sudah dibuka dari total `size` tile dengan `mineCount` mine,
 * dikalikan house edge kecil.
 */
function calculateMultiplier(size, mineCount, safeOpened) {
    if (safeOpened <= 0) return 1;
    let multiplier = 1;
    const safeTiles = size - mineCount;
    for (let i = 0; i < safeOpened; i++) {
        multiplier *= (size - i) / (safeTiles - i);
    }
    return Math.max(1, multiplier * HOUSE_EDGE);
}

/**
 * @param {number} size
 * @param {Set<number>} revealed
 * @param {Set<number>} mines
 * @param {boolean} showAll - tampilkan semua mine (dipakai saat game berakhir)
 * @param {number|null} lastIndex - index tile aman yang PALING BARU dibuka -> disorot beda warna
 */
function renderGrid(size, revealed, mines, showAll = false, lastIndex = null) {
    const cols = 4;
    const rows = [];
    for (let r = 0; r < size / cols; r++) {
        const rowTiles = [];
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (revealed.has(idx)) {
                if (mines.has(idx)) {
                    rowTiles.push("💣");
                } else {
                    // Tile aman yang baru saja dibuka disorot beda (hijau) dari tile aman sebelumnya (biru)
                    rowTiles.push(idx === lastIndex ? "💚" : "💎");
                }
            } else if (showAll) {
                rowTiles.push(mines.has(idx) ? "💥" : "⬜");
            } else {
                rowTiles.push("⬜");
            }
        }
        rows.push(rowTiles.join(" "));
    }
    return rows.join("\n");
}

module.exports = { GRID_SIZE, MINE_COUNT, generateGrid, calculateMultiplier, renderGrid };
