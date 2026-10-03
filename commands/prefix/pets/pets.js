const petService = require("../../../services/pets/petService.js");
const animalService = require("../../../services/animals/animalService.js");
const db = require("../../../utils/database.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "pets",
    aliases: [],
    category: "pets",
    description: "Lihat daftar pet kamu",
    usage: "zpets",
    async execute(message) {
        const userId = message.author.id;
        const pets = petService.getPets(userId);
        const user = db.getUser(userId);

        if (pets.length === 0) {
            return message.reply({
                embeds: [createInfoEmbed("Kamu belum punya pet. Adopsi animal dari koleksimu dengan `zpet adopt <instanceId>`.", "🐶 PETS")]
            });
        }

        const lines = pets.map((p) => {
            const stats = animalService.computeStats(p);
            const active = user.activePetId === p.instanceId ? " ⭐ (active)" : "";
            return `${stats.emoji} **${p.name}**${active} — Lv.${p.level} | HP ${stats.hp} ATK ${stats.atk} DEF ${stats.def} SPD ${stats.spd} \`${p.instanceId}\``;
        });

        await message.reply({ embeds: [createInfoEmbed(lines.join("\n"), "🐶 YOUR PETS")] });
    }
};
