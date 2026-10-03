/**
 * ============================================
 *  WELCOME / GOODBYE CARD GENERATOR (v3)
 *  Bikin banner gambar rapi buat member join & leave.
 *  Pakai @napi-rs/canvas (prebuilt binary, tidak perlu compile native).
 * ============================================
 */
const path = require("path");
const logger = require("./logger.js");

let canvasLib = null;
try {
    // Lazy-require supaya bot TETAP JALAN walaupun package ini belum di-install
    // (fallback otomatis ke embed teks biasa tanpa gambar, lihat generateCard()).
    canvasLib = require("@napi-rs/canvas");
} catch (err) {
    canvasLib = null;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
        result = result.slice(0, -1);
    }
    return result + "…";
}

/**
 * @param {import("discord.js").GuildMember} member
 * @param {"join"|"leave"} type
 * @returns {Promise<Buffer|null>} Buffer PNG, atau null kalau canvas tidak tersedia / gagal.
 */
async function generateCard(member, type = "join") {
    if (!canvasLib) return null;

    try {
        const { createCanvas, loadImage, GlobalFonts } = canvasLib;

        const WIDTH = 1000;
        const HEIGHT = 340;
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext("2d");

        const isJoin = type === "join";
        const accent = isJoin ? "#57F287" : "#ED4245";
        const accentSoft = isJoin ? "rgba(87, 242, 135, 0.18)" : "rgba(237, 66, 69, 0.18)";

        // ---------- Background ----------
        const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        bgGradient.addColorStop(0, "#1e1f27");
        bgGradient.addColorStop(1, "#15161c");
        ctx.fillStyle = bgGradient;
        roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
        ctx.fill();

        // Dekorasi lingkaran blur-ish di background biar tidak polos
        ctx.save();
        roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
        ctx.clip();
        ctx.fillStyle = accentSoft;
        ctx.beginPath();
        ctx.arc(WIDTH - 80, -40, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(60, HEIGHT + 30, 160, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Border tipis
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        roundRect(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 26);
        ctx.stroke();

        // ---------- Avatar ----------
        const avatarSize = 190;
        const avatarX = 75;
        const avatarY = HEIGHT / 2 - avatarSize / 2;

        try {
            const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
            const response = await fetch(avatarUrl, { signal: AbortSignal.timeout(5000) });
            if (!response.ok) throw new Error("Avatar unavailable");
            const avatarImg = await loadImage(Buffer.from(await response.arrayBuffer()));

            // Ring luar
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();
            ctx.restore();

            // Avatar (clip lingkaran)
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
        } catch (err) {
            logger.warn(`Gagal load avatar untuk welcome card: ${err.message}`);
        }

        // ---------- Teks ----------
        const textX = avatarX + avatarSize + 55;
        const maxTextWidth = WIDTH - textX - 50;

        try {
            GlobalFonts && GlobalFonts.registerFromPath && null; // no-op guard, font sistem default sudah cukup
        } catch (e) {}

        ctx.textBaseline = "alphabetic";

        // Label kecil (WELCOME / GOODBYE)
        ctx.font = "bold 28px sans-serif";
        ctx.fillStyle = accent;
        ctx.fillText(isJoin ? "✨ SELAMAT DATANG" : "👋 SAMPAI JUMPA", textX, 108);

        // Username besar
        ctx.font = "bold 54px sans-serif";
        ctx.fillStyle = "#ffffff";
        const displayName = truncateText(ctx, member.user.username, maxTextWidth);
        ctx.fillText(displayName, textX, 172);

        // Server name
        ctx.font = "26px sans-serif";
        ctx.fillStyle = "#b5b8c5";
        const serverLine = truncateText(ctx, `di ${member.guild.name}`, maxTextWidth);
        ctx.fillText(serverLine, textX, 212);

        // Member count pill
        const pillText = isJoin
            ? `Member ke-${member.guild.memberCount}`
            : `Sisa ${member.guild.memberCount} member`;
        ctx.font = "bold 22px sans-serif";
        const pillPadding = 22;
        const pillTextWidth = ctx.measureText(pillText).width;
        const pillWidth = pillTextWidth + pillPadding * 2;
        const pillHeight = 46;
        const pillY = 240;
        roundRect(ctx, textX, pillY, pillWidth, pillHeight, pillHeight / 2);
        ctx.fillStyle = accentSoft;
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        roundRect(ctx, textX, pillY, pillWidth, pillHeight, pillHeight / 2);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.fillText(pillText, textX + pillPadding, pillY + 30);

        return canvas.toBuffer("image/png");
    } catch (err) {
        logger.error(`Gagal generate welcome/goodbye card: ${err.message}`);
        return null;
    }
}

module.exports = { generateCard };
