/**
 * ============================================
 *  BOT STATS CARD GENERATOR (v3)
 *  Kartu gambar dashboard buat /botinfo — CPU, RAM, disk, dsb.
 *  Pakai @napi-rs/canvas, sama seperti welcome card.
 * ============================================
 */
const logger = require("./logger.js");

let canvasLib = null;
try {
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

function barColor(percent) {
    if (percent >= 90) return "#ED4245";
    if (percent >= 70) return "#FEE75C";
    return "#57F287";
}

/** Gambar 1 baris statistik dengan progress bar horizontal. */
function drawStatBar(ctx, x, y, width, label, valueText, percent) {
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x, y);

    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#b5b8c5";
    const valueWidth = ctx.measureText(valueText).width;
    ctx.fillText(valueText, x + width - valueWidth, y);

    const barY = y + 14;
    const barHeight = 16;
    roundRect(ctx, x, barY, width, barHeight, barHeight / 2);
    ctx.fillStyle = "#2b2d36";
    ctx.fill();

    const filledWidth = Math.max(barHeight, (Math.min(100, Math.max(0, percent)) / 100) * width);
    roundRect(ctx, x, barY, filledWidth, barHeight, barHeight / 2);
    ctx.fillStyle = barColor(percent);
    ctx.fill();
}

/**
 * @param {import("discord.js").Client} client
 * @param {object} info hasil dari utils/systemInfo.js -> collectSystemInfo()
 * @param {object} extra { botName, ping, servers, users }
 * @returns {Promise<Buffer|null>}
 */
async function generateStatsCard(client, info, extra = {}) {
    if (!canvasLib) return null;

    try {
        const { createCanvas, loadImage } = canvasLib;
        const WIDTH = 1000;
        const HEIGHT = 560;
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext("2d");

        // ---------- Background ----------
        const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        bg.addColorStop(0, "#1e1f27");
        bg.addColorStop(1, "#15161c");
        ctx.fillStyle = bg;
        roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
        ctx.fill();

        ctx.save();
        roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
        ctx.clip();
        ctx.fillStyle = "rgba(88, 101, 242, 0.16)";
        ctx.beginPath();
        ctx.arc(WIDTH - 60, -30, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "#5865F2";
        ctx.lineWidth = 4;
        roundRect(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 26);
        ctx.stroke();

        // ---------- Header: avatar bot + nama ----------
        const padding = 50;
        let headerY = 60;

        try {
            const avatarUrl = client.user.displayAvatarURL({ extension: "png", size: 128 });
            const avatarImg = await loadImage(avatarUrl);
            const avatarSize = 80;
            ctx.save();
            ctx.beginPath();
            ctx.arc(padding + avatarSize / 2, headerY + avatarSize / 2 - 15, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, padding, headerY - 15, avatarSize, avatarSize);
            ctx.restore();

            ctx.strokeStyle = "#5865F2";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(padding + avatarSize / 2, headerY + avatarSize / 2 - 15, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = "bold 34px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(extra.botName || client.user.username, padding + avatarSize + 24, headerY + 20);

            ctx.font = "20px sans-serif";
            ctx.fillStyle = "#57F287";
            ctx.fillText(
                `● Online  •  ${extra.ping ?? "?"}ms  •  ${extra.servers ?? "?"} server  •  ${extra.users ?? "?"} user`,
                padding + avatarSize + 24,
                headerY + 50
            );
        } catch (err) {
            logger.warn(`Gagal load avatar bot untuk stats card: ${err.message}`);
            ctx.font = "bold 34px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(extra.botName || "Bot Status", padding, headerY + 20);
        }

        ctx.strokeStyle = "#2b2d36";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, 130);
        ctx.lineTo(WIDTH - padding, 130);
        ctx.stroke();

        // ---------- Resource bars (CPU / RAM / Disk) ----------
        const barWidth = WIDTH - padding * 2;
        let y = 185;

        drawStatBar(ctx, padding, y, barWidth, "CPU", `${info.cpu.usagePercent}%  •  ${info.cpu.cores} core`, info.cpu.usagePercent);
        y += 60;
        drawStatBar(
            ctx,
            padding,
            y,
            barWidth,
            "RAM (Server)",
            `${info.memory.percent}%  •  ${(info.memory.used / 1073741824).toFixed(1)}GB / ${(info.memory.total / 1073741824).toFixed(1)}GB`,
            info.memory.percent
        );
        y += 60;
        if (info.disk.available) {
            drawStatBar(
                ctx,
                padding,
                y,
                barWidth,
                "Disk",
                `${info.disk.percent}%  •  ${(info.disk.used / 1073741824).toFixed(1)}GB / ${(info.disk.total / 1073741824).toFixed(1)}GB`,
                info.disk.percent
            );
            y += 60;
        }

        // ---------- Grid info detail ----------
        y += 20;
        const colWidth = barWidth / 2;
        const rowHeight = 54;

        const rows = [
            ["Node.js", info.process.nodeVersion],
            ["OS", `${info.os.type} (${info.os.platform}/${info.os.arch})`],
            ["Hostname", info.os.hostname],
            ["RAM Proses Bot", `${(info.process.rss / 1048576).toFixed(0)} MB`],
            ["Uptime Bot", extra.botUptimeText || "-"],
            ["Uptime Server", extra.osUptimeText || "-"]
        ];

        ctx.font = "bold 18px sans-serif";
        for (let i = 0; i < rows.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = padding + col * colWidth;
            const cy = y + row * rowHeight;

            ctx.fillStyle = "#8b8ea3";
            ctx.font = "16px sans-serif";
            ctx.fillText(rows[i][0].toUpperCase(), cx, cy);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 22px sans-serif";
            const val = ctx.measureText(rows[i][1]).width > colWidth - 20
                ? `${rows[i][1].slice(0, 28)}…`
                : rows[i][1];
            ctx.fillText(val, cx, cy + 26);
        }

        return canvas.toBuffer("image/png");
    } catch (err) {
        logger.error(`Gagal generate bot stats card: ${err.message}`);
        return null;
    }
}

module.exports = { generateStatsCard };
