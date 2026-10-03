const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");

const QUESTIONS = [
    { q: "Apa ibu kota Indonesia?", choices: ["Jakarta", "Bandung", "Surabaya", "Medan"], answer: 0 },
    { q: "Berapa hasil dari 9 x 9?", choices: ["81", "72", "99", "89"], answer: 0 },
    { q: "Planet apa yang dijuluki 'Planet Merah'?", choices: ["Venus", "Mars", "Jupiter", "Saturnus"], answer: 1 },
    { q: "Bahasa pemrograman apa yang digunakan Discord.js?", choices: ["Python", "Java", "JavaScript", "C++"], answer: 2 },
    { q: "Berapa jumlah benua di dunia?", choices: ["5", "6", "7", "8"], answer: 2 }
];

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder().setName("trivia").setDescription("Jawab pertanyaan trivia"),
    async execute(interaction) {
        const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
        const row = new ActionRowBuilder().addComponents(
            question.choices.map((choice, i) =>
                new ButtonBuilder().setCustomId(`trivia_${i}_${question.answer}`).setLabel(choice).setStyle(ButtonStyle.Secondary)
            )
        );

        const msg = await interaction.reply({ embeds: [createInfoEmbed(question.q, "🧠 Trivia")], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 20000, max: 1 });
        collector.on("collect", async (btn) => {
            if (btn.user.id !== interaction.user.id) {
                return btn.reply({ embeds: [createErrorEmbed("Ini bukan trivia kamu!")], ephemeral: true });
            }
            const [, chosen, correct] = btn.customId.split("_");
            const isCorrect = chosen === correct;
            await btn.update({
                embeds: [
                    isCorrect
                        ? createSuccessEmbed(`Benar! Jawabannya adalah **${question.choices[question.answer]}**.`)
                        : createErrorEmbed(`Salah! Jawaban yang benar adalah **${question.choices[question.answer]}**.`)
                ],
                components: []
            });
        });

        collector.on("end", async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({ embeds: [createInfoEmbed(`Waktu habis! Jawabannya adalah **${question.choices[question.answer]}**.`)], components: [] }).catch(() => {});
            }
        });
    }
};
