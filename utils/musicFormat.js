/**
 * Helper format untuk fitur musik (dipisah dari utils/music.js supaya
 * utils/musicPanel.js & utils/musicButtons.js bisa require ini tanpa
 * circular-dependency ke utils/music.js).
 */
const REPEAT_LABELS = ["Off", "Lagu Ini", "Semua Antrian"];

// Lavalink equalizer gains, limited below the API maximum.
const BASS_BOOST_PRESETS = {
    rendah: { label: "Rendah", value: 0.1 }, sedang: { label: "Sedang", value: 0.2 },
    tinggi: { label: "Tinggi", value: 0.35 }, ekstra: { label: "Ekstra", value: 0.5 }
};

function loopLabel(mode) {
    return REPEAT_LABELS[mode] ?? "Off";
}

/** Progress bar teks bergaya "modern" (pill/slider) untuk /nowplaying & panel musik. */
function progressBar(current, total, size = 18) {
    if (!total || Number.isNaN(total)) return "🔴 **LIVE**";
    const percent = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(size * percent);
    const bar = "─".repeat(Math.max(filled - 1, 0)) + "●" + "─".repeat(Math.max(size - filled, 0));
    return `\`${bar}\``;
}

function statusLine(queue) {
    return (
        `🔊 Volume: \`${queue.volume}%\` | ` +
        `🔁 Loop: \`${loopLabel(queue.repeatMode)}\` | ` +
        `▶️ Autoplay: \`${queue.autoplay ? "Aktif" : "Nonaktif"}\``
    );
}

module.exports = { REPEAT_LABELS, BASS_BOOST_PRESETS, loopLabel, progressBar, statusLine };
