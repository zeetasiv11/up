// Load local environment without replacing platform-provided variables.
try { process.loadEnvFile(); } catch (error) { if (error.code !== "ENOENT") throw error; }
/**
 * ============================================
 *  ZEECHEI BOT - SETTINGS.JS
 *  Semua konfigurasi bot ada di sini.
 *
 *  Untuk deploy di Render.com: token, clientId, guildId, dan ownerIds
 *  diambil dari Environment Variables yang kamu isi langsung di dashboard
 *  Render (Settings -> Environment), BUKAN ditulis di file ini. Ini supaya
 *  token rahasia kamu tidak ikut ter-push ke GitHub.
 *
 *  Kalau env var-nya kosong (misal waktu run lokal), nilai fallback
 *  di bawah ("") yang dipakai - jadi tetap bisa diisi manual juga kalau mau.
 * ============================================
 */

module.exports = {
    // Token bot Discord kamu (dari Discord Developer Portal).
    // Di Render, buat Environment Variable bernama DISCORD_TOKEN.
    token: process.env.DISCORD_TOKEN || "",

    // Client ID bot (dibutuhkan untuk registrasi slash command).
    // Di Render, buat Environment Variable bernama CLIENT_ID.
    clientId: process.env.CLIENT_ID || "",

    // (Opsional) Jika diisi, command hanya register ke 1 server (instan).
    // Kosongkan ("") untuk register global (bisa sampai 1 jam propagasi).
    // Di Render, Environment Variable bernama GUILD_ID (opsional).
    guildId: process.env.GUILD_ID || "",

    // ID Discord owner bot (bisa lebih dari satu).
    // Di Render, Environment Variable OWNER_IDS diisi dipisah koma,
    // contoh: 1443804231776862228,9988776655443322
    ownerIds: (process.env.OWNER_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),

    botName: "Zeechei Bot",
    prefix: "/",

    // Prefix untuk text command TANPA slash (contoh: zcash, zubj, zslots).
    // Ini terpisah dari slash command "/" di atas — keduanya tetap aktif bersamaan.
    textCommandPrefix: "z",

    colors: {
        primary: "#5865F2",
        success: "#57F287",
        error: "#ED4245",
        warning: "#FEE75C"
    },

    welcome: {
        enabled: true,
        channelId: "",
        message: "Selamat datang {user} di {server}! Kamu member ke-{memberCount} 🎉",
        // Kirim banner gambar (avatar + nama + member count) selain embed teks.
        // Butuh dependency "@napi-rs/canvas" (sudah ada di package.json, tinggal `npm install`).
        // Kalau package belum terpasang, bot otomatis fallback ke embed teks biasa (tidak crash).
        useCard: true
    },

    goodbye: {
        enabled: true,
        channelId: "",
        message: "{username} telah meninggalkan server. Sekarang tersisa {memberCount} member.",
        useCard: true
    },

    autoRole: {
        enabled: true,
        roleId: ""
    },

    // Sistem Reaction Role (v3) — member react emote di pesan tertentu -> otomatis dapat role.
    // Konfigurasi per-server (channel, pesan, emote, role) diatur lewat command /reactionrole,
    // datanya disimpan di database/database.json (lihat utils/database.js -> reactionRoles).
    reactionRoles: {
        enabled: true,
        // Kalau true, react ulang emote yang sama = role dilepas lagi (toggle).
        removeOnUnreact: true
    },

    logs: {
        enabled: true,
        channelId: ""
    },

    ticket: {
        categoryId: "",
        supportRoleIds: [],
        transcriptChannelId: ""
    },

    leveling: {
        enabled: true,
        xpPerMessage: { min: 15, max: 25 },
        cooldownSeconds: 60,
        levelUpChannelId: "" // kosong = kirim di channel yang sama
    },

    economy: {
        currencyName: "Coin",
        currencyIcon: "🪙",
        dailyAmount: 50000,
        workMin: 100,
        workMax: 400,
        workCooldownHours: 1,
        dailyCooldownHours: 24,

        // Batas maksimal saat pakai "all" di game gambling (zubj all, zmines all, dll).
        // Jadi "all" TIDAK langsung all-in saldo penuh, tapi dibatasi ke angka ini (kayak bot uwu).
        // Set ke 0 (atau null) kalau mau "all" balik jadi all-in saldo penuh lagi.
        maxAllBet: 250000
    },

    games: {
        mines: {
            gridSize: 16,       // total tile (4x4)
            defaultMines: 4,    // jumlah mine kalau user tidak menentukan
            minMines: 1,        // minimal mine yang boleh diatur user
            maxMines: 15        // maksimal mine (harus sisa minimal 1 tile aman)
        }
    },

    antiSpam: {
        enabled: false,
        maxMessages: 5,      // maksimal pesan
        intervalSeconds: 5,  // dalam rentang waktu ini
        maxMentions: 5,      // maksimal mention per pesan
        maxCapsPercent: 70,  // persentase huruf kapital maksimal (min 10 char)
        muteMinutes: 5
    },

    antiRaid: {
        enabled: false,
        joinThreshold: 10,   // jumlah join
        intervalSeconds: 10, // dalam rentang waktu ini
        alertChannelId: ""
    },

    cooldowns: {
        defaultCommandCooldown: 3, // detik
        gameCooldown: 5            // detik
    },

    statusRotation: {
        enabled: true,
        intervalSeconds: 20,
        statuses: [
            { text: "over {serverCount} servers", type: "Watching" },
            { text: "{userCount} users", type: "Watching" },
            { text: "help", type: "Listening" },
            { text: "Zeechei Bot", type: "Playing" }
        ]
    },

    maintenance: {
        enabled: false,
        message: "🔧 Bot sedang maintenance. Silakan coba lagi nanti."
    },

    music: {
        enabled: true,
        // Semua pemutaran memakai satu client dan satu panel per server.
        panelColor: "#8B1E2D",

        // Volume default saat bot join voice channel (0-150)
        defaultVolume: 100,

        // Maksimal jumlah lagu dalam satu antrian
        maxQueueSize: 300,

        // Bot otomatis keluar voice channel jika channel kosong (ditinggal semua orang)
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 60, // detik

        // Bot otomatis keluar voice channel jika antrian sudah habis
        leaveOnFinish: false,
        leaveOnFinishCooldown: 60, // detik

        // Bot otomatis keluar voice channel saat /stop dipakai
        leaveOnStop: true,

        // (Opsional) ID role DJ. Kosongkan ("") jika semua member boleh pakai command music.
        // Catatan: role ini belum ditegakkan otomatis oleh command bawaan, sediakan untuk pengembangan lebih lanjut.
        djRoleId: "",

        // Audio sources and plugins are configured on the external Lavalink node.
    }
};
