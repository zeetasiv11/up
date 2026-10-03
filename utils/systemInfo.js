/**
 * ============================================
 *  SYSTEM INFO HELPER (v3)
 *  Ambil data spesifikasi server tempat bot jalan:
 *  CPU, RAM, disk, OS, Node.js, uptime, dsb.
 * ============================================
 */
const os = require("os");
const fs = require("fs");

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatDuration(totalSeconds) {
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const days = Math.floor(totalSeconds / 86400);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!days) parts.push(`${seconds}s`); // detik cuma ditampilkan kalau durasi < 1 hari
    return parts.join(" ") || "0s";
}

/** Ambil rata-rata pemakaian CPU (%) dengan sampling 2x dalam rentang waktu singkat. */
function sampleCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        for (const key of Object.keys(cpu.times)) total += cpu.times[key];
        idle += cpu.times.idle;
    }
    return { idle, total };
}

function getCpuUsagePercent(sampleMs = 250) {
    return new Promise((resolve) => {
        const start = sampleCpuTimes();
        setTimeout(() => {
            const end = sampleCpuTimes();
            const idleDiff = end.idle - start.idle;
            const totalDiff = end.total - start.total;
            const usage = totalDiff > 0 ? 100 - Math.round((idleDiff / totalDiff) * 100) : 0;
            resolve(Math.max(0, Math.min(100, usage)));
        }, sampleMs);
    });
}

function getDiskInfo() {
    try {
        const stat = fs.statfsSync(process.cwd());
        const total = stat.blocks * stat.bsize;
        const free = stat.bfree * stat.bsize;
        const used = total - free;
        return {
            available: true,
            total,
            free,
            used,
            percent: total > 0 ? Math.round((used / total) * 100) : 0
        };
    } catch (err) {
        return { available: false };
    }
}

/**
 * Kumpulkan semua data sistem sekaligus.
 * Butuh sedikit waktu (default ~250ms) karena sampling CPU usage.
 */
async function collectSystemInfo(client) {
    const cpus = os.cpus();
    const cpuUsage = await getCpuUsagePercent();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const mem = process.memoryUsage();
    const disk = getDiskInfo();
    const loadAvg = os.loadavg(); // [1m, 5m, 15m] — kosong/0 di Windows

    return {
        cpu: {
            model: cpus[0]?.model?.trim() || "Tidak diketahui",
            cores: cpus.length,
            speedMHz: cpus[0]?.speed || 0,
            usagePercent: cpuUsage,
            loadAvg
        },
        memory: {
            total: totalMem,
            free: freeMem,
            used: usedMem,
            percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0
        },
        process: {
            rss: mem.rss,
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            nodeVersion: process.version,
            uptimeSeconds: process.uptime(),
            botUptimeMs: client?.startedAt ? Date.now() - client.startedAt : process.uptime() * 1000
        },
        disk,
        os: {
            platform: os.platform(),
            type: os.type(),
            release: os.release(),
            arch: os.arch(),
            hostname: os.hostname(),
            uptimeSeconds: os.uptime()
        }
    };
}

module.exports = { collectSystemInfo, formatBytes, formatDuration, getDiskInfo, getCpuUsagePercent };
