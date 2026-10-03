const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const settings = require("../../settings.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

const CATEGORY_OPTIONS = [
    { label: "👑 Admin & Owner", value: "admin", emoji: "👑" },
    { label: "👮 Moderation", value: "moderation", emoji: "👮" },
    { label: "🛠️ Utility", value: "utility", emoji: "🛠️" },
    { label: "🎉 Fun", value: "fun", emoji: "🎉" },
    { label: "🎮 Games", value: "games", emoji: "🎮" },
    { label: "💰 Economy", value: "economy", emoji: "💰" },
    { label: "🎵 Music", value: "music", emoji: "🎵" }
];

module.exports = {
    data: new SlashCommandBuilder().setName("help").setDescription("Tampilkan daftar command bot"),
    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("help_category_select")
                .setPlaceholder("Pilih kategori command...")
                .addOptions(CATEGORY_OPTIONS)
        );

        await interaction.reply({
            embeds: [
                createInfoEmbed(
                    `Total **${interaction.client.commands.size}** command tersedia.\nPilih kategori di menu bawah untuk melihat daftar command.`,
                    `📚 ${settings.botName} — Help Menu`
                )
            ],
            components: [row]
        });
    }
};
