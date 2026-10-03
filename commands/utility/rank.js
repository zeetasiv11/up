const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Lihat level & XP kamu atau orang lain")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat")),
    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const user = db.getUser(target.id);
        const xpNeeded = 5 * (user.level ** 2) + 50 * user.level + 100;

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `**Level:** ${user.level || 0}\n**XP:** ${user.xp || 0} / ${xpNeeded}`,
                    `🏆 Rank ${target.username}`
                ).setThumbnail(target.displayAvatarURL({ dynamic: true }))
            ]
        });
    }
};
