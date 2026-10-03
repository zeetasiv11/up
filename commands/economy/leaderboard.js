const { SlashCommandBuilder } = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Lihat leaderboard saldo atau level")
        .addStringOption((o) =>
            o.setName("type").setDescription("Jenis leaderboard").addChoices(
                { name: "Saldo", value: "balance" },
                { name: "Level", value: "level" }
            )
        ),
    async execute(interaction) {
        const type = interaction.options.getString("type") || "balance";
        const database = db.getDB();
        const entries = Object.entries(database.users);

        if (entries.length === 0) {
            return interaction.reply({ embeds: [createInfoEmbed("Belum ada data leaderboard.")] });
        }

        const sorted = entries.sort((a, b) => (type === "level" ? b[1].level - a[1].level || b[1].xp - a[1].xp : b[1].balance - a[1].balance)).slice(0, 10);

        const lines = await Promise.all(
            sorted.map(async ([userId, data], i) => {
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                const name = user ? user.tag : `Unknown (${userId})`;
                const value = type === "level" ? `Level ${data.level} (${data.xp} XP)` : `${settings.economy.currencyIcon} ${data.balance.toLocaleString("id-ID")}`;
                return `**${i + 1}.** ${name} — ${value}`;
            })
        );

        await interaction.reply({
            embeds: [createInfoEmbed(lines.join("\n"), type === "level" ? "🏆 Level Leaderboard" : "🏆 Balance Leaderboard")]
        });
    }
};
