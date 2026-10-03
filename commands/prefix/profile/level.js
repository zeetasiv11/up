const db = require("../../../utils/database.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

function xpForLevel(level) {
    return 5 * level ** 2 + 50 * level + 100;
}

module.exports = {
    name: "level",
    aliases: ["lvl"],
    category: "profile",
    description: "Lihat level & XP kamu",
    usage: "zlevel [@user]",
    async execute(message) {
        const target = message.mentions.users.first() || message.author;
        const user = db.getUser(target.id);
        await message.reply({
            embeds: [createInfoEmbed(`Level: **${user.level || 0}**\nXP: **${user.xp || 0}/${xpForLevel(user.level || 0)}**`, `📊 ${target.username.toUpperCase()}'S LEVEL`)]
        });
    }
};
