const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const VALID_TYPES = ["coins", "level", "animals", "wins", "battle"];

function scoreFor(type, data) {
    if (type === "level") return (data.level || 0) * 100000 + (data.xp || 0);
    if (type === "animals") return (data.animals || []).length;
    if (type === "wins") return data.gambling?.wins || 0;
    if (type === "battle") return data.battle?.wins || 0;
    return (data.balance || 0) + (data.bank || 0); // coins (default)
}

function displayFor(type, data) {
    if (type === "level") return `Level ${data.level || 0}`;
    if (type === "animals") return `${(data.animals || []).length} animal`;
    if (type === "wins") return `${data.gambling?.wins || 0} wins`;
    if (type === "battle") return `${data.battle?.wins || 0} battle wins`;
    return `${settings.economy.currencyIcon} ${((data.balance || 0) + (data.bank || 0)).toLocaleString("id-ID")}`;
}

module.exports = {
    name: "leaderboard",
    aliases: ["lb"],
    category: "profile",
    description: "Lihat leaderboard (coins/level/animals/wins/battle)",
    usage: "zleaderboard [coins|level|animals|wins|battle]",
    async execute(message, args) {
        const type = (args[0] || "coins").toLowerCase();
        if (!VALID_TYPES.includes(type)) {
            return message.reply({ embeds: [createErrorEmbed(`❌ Tipe tidak valid. Pilihan: ${VALID_TYPES.join(", ")}`)] });
        }

        const database = db.getDB();
        const entries = Object.entries(database.users);
        if (entries.length === 0) {
            return message.reply({ embeds: [createInfoEmbed("Belum ada data leaderboard.")] });
        }

        const sorted = entries.sort((a, b) => scoreFor(type, b[1]) - scoreFor(type, a[1])).slice(0, 10);
        const lines = await Promise.all(
            sorted.map(async ([userId, data], i) => {
                const user = await message.client.users.fetch(userId).catch(() => null);
                const name = user ? user.username : `Unknown (${userId})`;
                return `**${i + 1}.** ${name} — ${displayFor(type, data)}`;
            })
        );

        await message.reply({ embeds: [createInfoEmbed(lines.join("\n"), `🏆 LEADERBOARD — ${type.toUpperCase()}`)] });
    }
};
