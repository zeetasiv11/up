const db = require("../../../utils/database.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "couple",
    aliases: [],
    category: "marriage",
    description: "Lihat status pernikahan kamu",
    usage: "zcouple [@user]",
    async execute(message) {
        const target = message.mentions.users.first() || message.author;
        const user = db.getUser(target.id);
        const partnerId = user.marriage?.partnerId;

        if (!partnerId) {
            return message.reply({ embeds: [createInfoEmbed(`${target.username} belum menikah.`, "💍 COUPLE STATUS")] });
        }

        const marriedDate = new Date(user.marriage.marriedAt).toLocaleDateString("id-ID");
        await message.reply({
            embeds: [createInfoEmbed(`${target.username} 💍 <@${partnerId}>\n\nMenikah sejak: **${marriedDate}**`, "💍 COUPLE STATUS")]
        });
    }
};
