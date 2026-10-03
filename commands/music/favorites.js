const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createInfoEmbed, createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("favorites")
        .setDescription("Lihat atau kelola daftar lagu favorit kamu")
        .addSubcommand((sub) => sub.setName("list").setDescription("Lihat daftar lagu favorit kamu"))
        .addSubcommand((sub) =>
            sub
                .setName("remove")
                .setDescription("Hapus lagu dari daftar favorit")
                .addIntegerOption((o) => o.setName("nomor").setDescription("Nomor lagu (lihat /favorites list)").setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) => sub.setName("clear").setDescription("Hapus semua lagu favorit kamu")),
    category: "music",
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = db.getUser(interaction.user.id);
        const favorites = user.favoriteSongs || [];

        if (sub === "list") {
            if (!favorites.length) {
                return interaction.reply({
                    embeds: [createInfoEmbed("Kamu belum punya lagu favorit. Klik tombol ❤️ di panel musik saat lagu diputar untuk menambahkan.", "⭐ Favorit Kamu")],
                    ephemeral: true
                });
            }
            const lines = favorites.slice(0, 25).map((f, i) => `**${i + 1}.** [${f.name}](${f.url})`);
            const more = favorites.length > 25 ? `\n...dan **${favorites.length - 25}** lagu lainnya.` : "";
            return interaction.reply({
                embeds: [createInfoEmbed(`${lines.join("\n")}${more}`, `⭐ Favorit Kamu (${favorites.length} lagu)`)],
                ephemeral: true
            });
        }

        if (sub === "remove") {
            const nomor = interaction.options.getInteger("nomor", true);
            if (nomor > favorites.length) {
                return interaction.reply({ embeds: [createErrorEmbed(`Nomor tidak valid. Kamu hanya punya ${favorites.length} lagu favorit.`)], ephemeral: true });
            }
            const removed = favorites.splice(nomor - 1, 1)[0];
            db.updateUser(interaction.user.id, { favoriteSongs: favorites });
            return interaction.reply({ embeds: [createSuccessEmbed(`**${removed.name}** dihapus dari favorit.`)], ephemeral: true });
        }

        if (sub === "clear") {
            db.updateUser(interaction.user.id, { favoriteSongs: [] });
            return interaction.reply({ embeds: [createSuccessEmbed("Semua lagu favorit kamu telah dihapus.")], ephemeral: true });
        }
    }
};
