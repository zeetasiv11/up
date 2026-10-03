const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const RESPONSES = [
    "🎱 Definitely!",
    "🎱 It is certain.",
    "🎱 Probably.",
    "🎱 Yes, tentu saja.",
    "🎱 Ask again later.",
    "🎱 Cannot predict now.",
    "🎱 Nope.",
    "🎱 Very doubtful.",
    "🎱 My sources say no.",
    "🎱 Without a doubt."
];

module.exports = {
    name: "8ball",
    aliases: [],
    category: "fun",
    description: "Tanya bola ajaib",
    usage: "z8ball <pertanyaan>",
    async execute(message, args) {
        if (args.length === 0) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `z8ball <pertanyaan>`")] });
        }
        const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
        await message.reply({ embeds: [createInfoEmbed(`**Q:** ${args.join(" ")}\n**A:** ${answer}`, "🎱 8BALL")] });
    }
};
