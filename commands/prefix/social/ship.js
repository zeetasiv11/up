const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "ship",
    aliases: [],
    category: "social",
    description: "Hitung compatibility antara 2 user",
    usage: "zship @user1 [@user2]",
    async execute(message) {
        const mentioned = [...message.mentions.users.values()];
        const userA = mentioned[0] || message.author;
        const userB = mentioned[1] || (mentioned[0] ? message.author : null);

        if (!userA || !userB || userA.id === userB.id) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zship @user1 @user2` atau `zship @user`")] });
        }

        // Seed sederhana dari kombinasi ID biar hasil konsisten untuk pasangan yang sama.
        const seed = [...`${userA.id}${userB.id}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const percent = seed % 101;

        let verdict = "Coba lagi lain kali...";
        if (percent >= 80) verdict = "Looks like a great match! 💕";
        else if (percent >= 50) verdict = "Ada potensi nih! 😏";
        else if (percent >= 20) verdict = "Hmm, masih perlu usaha lebih. 😅";

        await message.reply({
            embeds: [createInfoEmbed(`${userA.username} ❤️ ${userB.username}\n\n**${percent}%**\n\n"${verdict}"`, "❤️ LOVE COMPATIBILITY")]
        });
    }
};
