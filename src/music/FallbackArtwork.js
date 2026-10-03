const { createHash } = require("node:crypto");
const cache = new Map();
function fallbackArtwork(title, artist) {
    const key = createHash("sha256").update(`${title}\n${artist}`).digest("hex");
    if (cache.has(key)) return { name: `art-${key.slice(0, 12)}.png`, attachment: cache.get(key) };
    try {
        const { createCanvas } = require("@napi-rs/canvas");
        const canvas = createCanvas(600, 600),
            ctx = canvas.getContext("2d");
        ctx.fillStyle = "#201d29";
        ctx.fillRect(0, 0, 600, 600);
        ctx.strokeStyle = "#41374f";
        for (let radius = 45; radius < 240; radius += 12) {
            ctx.beginPath();
            ctx.arc(300, 260, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = "#b7a4ef";
        ctx.beginPath();
        ctx.arc(300, 260, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#211929";
        ctx.font = "italic bold 90px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("z", 295, 283);
        ctx.fillStyle = "#f1f1f5";
        ctx.font = "bold 27px sans-serif";
        let text = String(title || "Your listening space");
        while (ctx.measureText(text).width > 510) text = text.slice(0, -2);
        ctx.fillText(text, 300, 532);
        ctx.fillStyle = "#b7bac7";
        ctx.font = "18px sans-serif";
        ctx.fillText(String(artist || "Zeechei Music").slice(0, 48), 300, 567);
        const buffer = canvas.toBuffer("image/png");
        if (cache.size >= 32) cache.delete(cache.keys().next().value);
        cache.set(key, buffer);
        return { name: `art-${key.slice(0, 12)}.png`, attachment: buffer };
    } catch {
        return null;
    }
}
module.exports = { fallbackArtwork };
