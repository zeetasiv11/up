const marriageController = require("../../../services/social/marriageController.js");
const { createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "marry",
    aliases: ["propose"],
    category: "marriage",
    description: "Lamar user lain untuk menikah",
    usage: "zmarry @user",
    async execute(message) {
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zmarry @user`")] });
        }
        if (target.bot) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak bisa melamar bot.")] });
        }
        await marriageController.propose(message, message.author.id, target.id);
    }
};
