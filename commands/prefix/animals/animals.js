const animalService = require("../../../services/animals/animalService.js");
const { getAnimal, RARITY } = require("../../../data/animals.js");
const { createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

const PAGE_SIZE = 10;

module.exports = {
    name: "animals",
    aliases: ["zoo"],
    category: "animals",
    description: "Lihat koleksi animal kamu",
    usage: "zanimals [halaman]",
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const animals = animalService.getAnimals(target.id);

        if (animals.length === 0) {
            return message.reply({ embeds: [createInfoEmbed(`${target.username} belum punya animal. Coba \`zhunt\` dulu!`, "🐾 ANIMAL COLLECTION")] });
        }

        const page = Math.max(1, parseInt(args[0], 10) || 1);
        const totalPages = Math.ceil(animals.length / PAGE_SIZE);
        if (page > totalPages) {
            return message.reply({ embeds: [createErrorEmbed(`❌ Halaman tidak ada. Total halaman: ${totalPages}.`)] });
        }

        const slice = animals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        const lines = slice.map((a) => {
            const template = getAnimal(a.animalId);
            const rarity = RARITY[a.rarity];
            return `${template.emoji} **${template.name}** — ${rarity.emoji} ${rarity.label} (Lv. ${a.level}) \`${a.instanceId}\``;
        });

        const counts = animalService.rarityCounts(target.id);
        const summary = Object.entries(counts).map(([r, c]) => `${RARITY[r]?.emoji || ""} ${c}`).join("  ");

        await message.reply({
            embeds: [createInfoEmbed(
                `${lines.join("\n")}\n\nTotal: **${animals.length}** animal\n${summary}\n\nHalaman ${page}/${totalPages}`,
                `🐾 ${target.username.toUpperCase()}'S ANIMALS`
            )]
        });
    }
};
