const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Kelola blacklist user (owner only)")
        .addSubcommand((sub) =>
            sub.setName("add").setDescription("Tambahkan user ke blacklist")
                .addUserOption((o) => o.setName("user").setDescription("User yang akan di-blacklist").setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("remove").setDescription("Hapus user dari blacklist")
                .addUserOption((o) => o.setName("user").setDescription("User yang akan dihapus dari blacklist").setRequired(true))
        )
        .addSubcommand((sub) => sub.setName("list").setDescription("Lihat daftar user yang di-blacklist")),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "add") {
            const target = interaction.options.getUser("user");
            db.addBlacklist(target.id);
            return interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil ditambahkan ke blacklist.`)] });
        }
        if (sub === "remove") {
            const target = interaction.options.getUser("user");
            db.removeBlacklist(target.id);
            return interaction.reply({ embeds: [createSuccessEmbed(`${target.tag} berhasil dihapus dari blacklist.`)] });
        }
        if (sub === "list") {
            const database = db.getDB();
            if (database.blacklist.length === 0) {
                return interaction.reply({ embeds: [createInfoEmbed("Blacklist kosong.")] });
            }
            return interaction.reply({ embeds: [createInfoEmbed(database.blacklist.map((id) => `<@${id}> (${id})`).join("\n"), "🚫 Blacklist")] });
        }
    }
};
