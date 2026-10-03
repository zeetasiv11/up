const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const stats = require("../../../services/economy/statsService.js");
const sessionManager = require("../../../services/game/sessionManager.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 10 * 1000;
const TIMEOUT_MS = 30 * 1000;
const MAX_NUMBER = 100;

module.exports = {
    name: "guess",
    aliases: [],
    category: "games",
    description: "Tebak angka 1-100 yang dipilih bot",
    usage: "zguess",
    async execute(message) {
        const userId = message.author.id;

        const remaining = cooldownManager.checkCooldown("guess", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum main Guess lagi.`)] });
        }

        const answer = Math.floor(Math.random() * MAX_NUMBER) + 1;
        const session = sessionManager.createSession("guess", userId, { answer }, TIMEOUT_MS, async () => {
            message.channel.send({
                content: `${message.author}`,
                embeds: [createInfoEmbed(`⏳ Waktu habis! Jawabannya adalah **${answer}**.`, "🎯 GUESS")]
            }).catch(() => {});
        });

        if (!session) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu masih punya sesi Guess yang berjalan.")] });
        }

        await message.reply({
            embeds: [createInfoEmbed(`Aku sudah memilih angka **1-${MAX_NUMBER}**.\nBalas dengan angka tebakanmu dalam **30 detik**!`, "🎯 GUESS")]
        });

        const collector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === userId && /^\d+$/.test(m.content.trim()),
            time: TIMEOUT_MS
        });

        collector.on("collect", async (m) => {
            const current = sessionManager.getSession(session.id);
            if (!current) {
                collector.stop("ended");
                return;
            }

            const guessValue = parseInt(m.content.trim(), 10);
            if (guessValue === current.data.answer) {
                sessionManager.endSession(session.id);
                collector.stop("won");
                const reward = 500 + Math.floor(Math.random() * 1500);
                economy.addBalance(userId, reward);
                stats.recordGameResult(userId, { won: true, wager: 0 });
                logger.game(`Guess ${userId} answer=${current.data.answer} won=true`);
                await m.reply({ embeds: [createSuccessEmbed(`Benar! Angkanya adalah **${current.data.answer}**.\nKamu mendapatkan **${reward.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`, "🎯 GUESS")] });
            } else {
                const hint = guessValue < current.data.answer ? "⬆️ Lebih tinggi!" : "⬇️ Lebih rendah!";
                await m.reply({ embeds: [createInfoEmbed(hint, "🎯 GUESS")] }).catch(() => {});
            }
        });

        collector.on("end", (_collected, reason) => {
            if (reason !== "won" && reason !== "ended") {
                sessionManager.endSession(session.id);
            }
        });
    }
};
