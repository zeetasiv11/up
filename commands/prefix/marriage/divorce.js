const db = require("../../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "divorce",
    aliases: [],
    category: "marriage",
    description: "Bercerai dari pasangan kamu",
    usage: "zdivorce",
    async execute(message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const partnerId = user.marriage?.partnerId;

        if (!partnerId) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu belum menikah.")] });
        }

        db.updateUser(userId, { marriage: { partnerId: "", marriedAt: 0 } });
        db.updateUser(partnerId, { marriage: { partnerId: "", marriedAt: 0 } });

        await message.reply({ embeds: [createSuccessEmbed(`Kamu resmi bercerai dari <@${partnerId}>. 💔`, "💔 DIVORCED")] });
    }
};
