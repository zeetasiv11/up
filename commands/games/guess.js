const { SlashCommandBuilder } = require("discord.js");
const { createSuccessEmbed, createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("guess").setDescription("Tebak angka 1-100, kamu dapat 5 kesempatan"),
    async execute(interaction) {
        const target = Math.floor(Math.random() * 100) + 1;
        await interaction.reply({
            embeds: [createInfoEmbed("Aku sudah memikirkan angka antara **1-100**. Ketik angka tebakanmu di chat! Kamu punya 5 kesempatan dan 30 detik.", "🔢 Guess The Number")]
        });

        let attempts = 0;
        const collector = interaction.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id && !isNaN(m.content),
            time: 30000,
            max: 5
        });

        collector.on("collect", async (m) => {
            attempts++;
            const guess = parseInt(m.content, 10);
            if (guess === target) {
                collector.stop("won");
                await m.reply({ embeds: [createSuccessEmbed(`Benar! Angkanya adalah **${target}**. Kamu menebak dalam ${attempts} percobaan! 🎉`)] });
            } else if (attempts >= 5) {
                collector.stop("lost");
                await m.reply({ embeds: [createInfoEmbed(`Kehabisan kesempatan! Angkanya adalah **${target}**.`)] });
            } else {
                await m.reply({ embeds: [createInfoEmbed(guess < target ? "Lebih tinggi! ⬆️" : "Lebih rendah! ⬇️")] });
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "time") {
                await interaction.followUp({ embeds: [createInfoEmbed(`Waktu habis! Angkanya adalah **${target}**.`)] });
            }
        });
    }
};
