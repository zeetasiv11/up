const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

const JOKES = [
    "Kenapa programmer suka gelap? Karena mereka takut sama bug (bugs love light)... eh salah, mereka suka dark mode! 😄",
    "Kenapa komputer masuk angin? Karena dia lupa nutup Windows-nya!",
    "Kenapa developer selalu bawa payung? Biar ga kena exception!",
    "Apa bedanya kamu sama bug? Bug bisa di-fix.",
    "Kenapa kabel USB susah dicolok pertama kali? Karena dia perlu 3 kali percobaan, seperti kehidupan."
];

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("joke").setDescription("Dapatkan lelucon receh"),
    async execute(interaction) {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        await interaction.reply({ embeds: [createInfoEmbed(joke, "😂 Joke")] });
    }
};
