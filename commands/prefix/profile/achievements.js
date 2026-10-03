const achievementService = require("../../../services/achievement/achievementService.js");
const settings = require("../../../settings.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "achievements",
    aliases: ["ach"],
    category: "profile",
    description: "Lihat & klaim achievement kamu",
    usage: "zachievements | zachievements claim <id>",
    async execute(message, args) {
        const userId = message.author.id;

        if ((args[0] || "").toLowerCase() === "claim" && args[1]) {
            const result = achievementService.claim(userId, args[1].toLowerCase());
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            return message.reply({ embeds: [createSuccessEmbed(`Reward diklaim: **${result.reward.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`, "🏆 ACHIEVEMENT CLAIMED")] });
        }

        const status = achievementService.computeStatus(userId);
        const lines = status.map((a) => {
            const mark = a.claimed ? "✅" : a.unlocked ? "🎁" : "🔒";
            const hint = a.unlocked && !a.claimed ? ` — \`zachievements claim ${a.id}\`` : "";
            return `${mark} **${a.label}** — ${a.desc}${hint}`;
        });

        await message.reply({ embeds: [createInfoEmbed(lines.join("\n"), "🏆 ACHIEVEMENTS")] });
    }
};
