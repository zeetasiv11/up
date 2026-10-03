const settings = require("../../../settings.js");
const economy = require("../../../services/economy/economyService.js");
const questService = require("../../../services/quest/questService.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "quest",
    aliases: ["quests"],
    category: "quest",
    description: "Lihat & klaim daily quest",
    usage: "zquest | zquest claim <no> | zquest reroll",
    async execute(message, args) {
        const userId = message.author.id;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "reroll") {
            const result = questService.rerollQuests(userId);
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            return message.reply({ embeds: [createSuccessEmbed("Quest berhasil di-reroll!", "📜 QUEST REROLL")] });
        }

        if (sub === "claim") {
            const index = parseInt(args[1], 10) - 1;
            const result = questService.claimQuest(userId, index);
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            economy.addBalance(userId, result.reward);
            return message.reply({ embeds: [createSuccessEmbed(`Reward diklaim: **${result.reward.toLocaleString("id-ID")}** ${settings.economy.currencyIcon}!`, "📜 QUEST CLAIMED")] });
        }

        const quests = questService.getQuests(userId);
        const lines = quests.list.map((q, i) => {
            const status = q.claimed ? "✅ Claimed" : q.progress >= q.target ? "🎁 Siap diklaim! (`zquest claim " + (i + 1) + "`)" : "⏳ Berlangsung";
            return `**${i + 1}. ${q.label}**\nProgress: ${q.progress}/${q.target} — Reward: ${q.reward.toLocaleString("id-ID")} ${settings.economy.currencyIcon}\n${status}`;
        });

        await message.reply({
            embeds: [createInfoEmbed(`${lines.join("\n\n")}\n\nReroll (1x/hari): \`zquest reroll\``, "📜 DAILY QUESTS")]
        });
    }
};
