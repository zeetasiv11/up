const { createInfoEmbed } = require("../utils/embeds.js");
const { handleMusicMoreMenu } = require("../utils/musicButtons.js");

const CATEGORY_LABELS = {
    admin: "👑 Admin & Owner",
    moderation: "👮 Moderation",
    utility: "🛠️ Utility",
    fun: "🎉 Fun",
    games: "🎮 Games",
    economy: "💰 Economy",
    music: "🎵 Music"
};

async function handleSelectMenu(interaction, client) {
    if (interaction.customId === "music_more_menu") return handleMusicMoreMenu(interaction);
    if (interaction.customId !== "help_category_select") return;

    const category = interaction.values[0];
    const commands = [...client.commands.values()].filter((c) => c.category === category);

    const description = commands.length
        ? commands.map((c) => `**/${c.data.name}** — ${c.data.description}`).join("\n")
        : "Tidak ada command di kategori ini.";

    await interaction.update({
        embeds: [createInfoEmbed(description, `${CATEGORY_LABELS[category] ?? category}`)]
    });
}

module.exports = { handleSelectMenu };
