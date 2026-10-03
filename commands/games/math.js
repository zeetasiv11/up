const { SlashCommandBuilder } = require("discord.js");
const { createSuccessEmbed, createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("math").setDescription("Jawab soal matematika sederhana secepat mungkin"),
    async execute(interaction) {
        const ops = ["+", "-", "*"];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const a = Math.floor(Math.random() * 50) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        let result;
        if (op === "+") result = a + b;
        else if (op === "-") result = a - b;
        else result = a * b;

        await interaction.reply({ embeds: [createInfoEmbed(`Berapa hasil dari **${a} ${op} ${b}**?\nKamu punya 15 detik!`, "➕ Math Challenge")] });

        const collector = interaction.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id && !isNaN(m.content),
            time: 15000,
            max: 1
        });

        collector.on("collect", async (m) => {
            if (parseInt(m.content, 10) === result) {
                await m.reply({ embeds: [createSuccessEmbed(`Benar! Jawabannya adalah **${result}**. 🎉`)] });
            } else {
                await m.reply({ embeds: [createInfoEmbed(`Salah! Jawaban yang benar adalah **${result}**.`)] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.followUp({ embeds: [createInfoEmbed(`Waktu habis! Jawabannya adalah **${result}**.`)] }).catch(() => {});
            }
        });
    }
};
