const petService = require("../../../services/pets/petService.js");
const animalService = require("../../../services/animals/animalService.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "pet",
    aliases: [],
    category: "pets",
    description: "Kelola pet: adopt / equip / rename / stats / feed",
    usage: "zpet adopt <instanceId> | zpet equip <instanceId> | zpet stats | zpet feed <instanceId> <itemId> | zpet rename <instanceId> <nama>",
    async execute(message, args) {
        const userId = message.author.id;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "adopt") {
            const result = petService.adopt(userId, args[1], args.slice(2).join(" "));
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            return message.reply({ embeds: [createSuccessEmbed(`Kamu mengadopsi **${result.pet.name}** sebagai pet! ID: \`${result.pet.instanceId}\``, "🐶 PET ADOPTED")] });
        }

        if (sub === "equip") {
            const result = petService.equip(userId, args[1]);
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            return message.reply({ embeds: [createSuccessEmbed("Pet berhasil di-equip sebagai active pet untuk battle!", "🐶 PET EQUIPPED")] });
        }

        if (sub === "feed") {
            const result = petService.feed(userId, args[1], args[2]);
            if (!result.ok) return message.reply({ embeds: [createErrorEmbed(result.error)] });
            const levelText = result.leveledUp ? " 🎉 Pet naik level!" : "";
            return message.reply({ embeds: [createSuccessEmbed(`Kamu memberi makan **${result.pet.name}**.${levelText}`, "🍖 PET FED")] });
        }

        if (sub === "rename") {
            const pets = petService.getPets(userId);
            const pet = pets.find((p) => p.instanceId === args[1]);
            if (!pet) return message.reply({ embeds: [createErrorEmbed("❌ Pet tidak ditemukan.")] });
            const newName = args.slice(2).join(" ").trim();
            if (!newName) return message.reply({ embeds: [createErrorEmbed("❌ Masukkan nama baru. Contoh: `zpet rename <id> Rocky`")] });
            pet.name = newName.slice(0, 32);
            require("../../../utils/database.js").updateUser(userId, { pets });
            return message.reply({ embeds: [createSuccessEmbed(`Pet berhasil diganti nama menjadi **${pet.name}**.`, "🐶 PET RENAMED")] });
        }

        if (sub === "stats") {
            const active = petService.getActivePet(userId);
            if (!active) return message.reply({ embeds: [createInfoEmbed("Kamu belum punya active pet.", "🐶 PET STATS")] });
            const stats = animalService.computeStats(active);
            return message.reply({
                embeds: [createInfoEmbed(
                    `${stats.emoji} **${active.name}**\nLevel: ${active.level}\nHP: ${stats.hp}\nATK: ${stats.atk}\nDEF: ${stats.def}\nSPD: ${stats.spd}`,
                    "🐶 ACTIVE PET STATS"
                )]
            });
        }

        return message.reply({
            embeds: [createInfoEmbed("Gunakan: `zpet adopt <instanceId>`, `zpet equip <instanceId>`, `zpet feed <instanceId> <itemId>`, `zpet rename <instanceId> <nama>`, `zpet stats`", "🐶 PET")]
        });
    }
};
