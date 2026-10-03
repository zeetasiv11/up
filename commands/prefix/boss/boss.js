const settings = require("../../../settings.js");
const bossService = require("../../../services/battle/bossService.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const ATTACK_COOLDOWN_MS = 15 * 1000;

function renderHpBar(current, max, length = 20) {
    const filled = Math.round((current / max) * length);
    return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, length - filled));
}

module.exports = {
    name: "boss",
    aliases: [],
    category: "battle",
    description: "World boss server — serang bareng-bareng!",
    usage: "zboss | zboss attack",
    async execute(message, args) {
        const guildId = message.guild.id;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "attack") {
            const remaining = cooldownManager.checkCooldown("boss", message.author.id, ATTACK_COOLDOWN_MS);
            if (remaining > 0) {
                return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum menyerang boss lagi.`)] });
            }

            const result = bossService.attack(guildId, message.author.id);
            if (!result.ok) {
                return message.reply({ embeds: [createErrorEmbed(result.error)] });
            }

            if (result.defeated) {
                const topLines = result.rewards.slice(0, 5).map((r, i) => `**${i + 1}.** <@${r.userId}> — ${r.damage.toLocaleString("id-ID")} dmg → +${r.share.toLocaleString("id-ID")} ${settings.economy.currencyIcon}`);
                return message.reply({
                    embeds: [createSuccessEmbed(`${result.boss.emoji} **${result.boss.name}** telah dikalahkan!\n\n${topLines.join("\n")}`, "🐉 WORLD BOSS DEFEATED")]
                });
            }

            const bar = renderHpBar(result.boss.hp, result.boss.maxHp);
            return message.reply({
                embeds: [createInfoEmbed(
                    `${result.boss.emoji} **${result.boss.name}**\n${bar}\nHP: ${result.boss.hp.toLocaleString("id-ID")} / ${result.boss.maxHp.toLocaleString("id-ID")}\n\nKamu memberikan **${result.damage.toLocaleString("id-ID")}** damage!`,
                    "🐉 WORLD BOSS"
                )]
            });
        }

        // default: lihat status / spawn kalau belum ada
        let boss = bossService.getBoss(guildId);
        if (!boss) {
            boss = bossService.spawnBoss(guildId);
            const bar = renderHpBar(boss.hp, boss.maxHp);
            return message.reply({
                embeds: [createSuccessEmbed(`${boss.emoji} **${boss.name}** muncul di server ini!\n${bar}\nHP: ${boss.hp.toLocaleString("id-ID")} / ${boss.maxHp.toLocaleString("id-ID")}\n\nGunakan \`zboss attack\` untuk menyerang!`, "🐉 WORLD BOSS SPAWNED")]
            });
        }

        const bar = renderHpBar(boss.hp, boss.maxHp);
        await message.reply({
            embeds: [createInfoEmbed(`${boss.emoji} **${boss.name}**\n${bar}\nHP: ${boss.hp.toLocaleString("id-ID")} / ${boss.maxHp.toLocaleString("id-ID")}\n\nGunakan \`zboss attack\` untuk menyerang!`, "🐉 WORLD BOSS")]
        });
    }
};
