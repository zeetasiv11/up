const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "choose",
    aliases: ["pick"],
    category: "fun",
    description: "Bot memilih satu opsi secara random",
    usage: "zchoose opsi1 | opsi2 | opsi3",
    async execute(message, args) {
        const options = args.join(" ").split("|").map((o) => o.trim()).filter(Boolean);
        if (options.length < 2) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zchoose opsi1 | opsi2 | opsi3`")] });
        }
        const picked = options[Math.floor(Math.random() * options.length)];
        await message.reply({ embeds: [createInfoEmbed(`Aku pilih: **${picked}**`, "🤔 CHOOSE")] });
    }
};
