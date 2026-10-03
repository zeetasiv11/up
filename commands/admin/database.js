const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../utils/embeds.js");

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("database")
        .setDescription("Kelola database bot (owner only)")
        .addSubcommand((sub) =>
            sub.setName("view").setDescription("Lihat data seorang user")
                .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat datanya").setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("deleteuser").setDescription("Hapus data seorang user dari database")
                .addUserOption((o) => o.setName("user").setDescription("User yang datanya akan dihapus").setRequired(true))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser("user");
        const database = db.getDB();

        if (sub === "view") {
            const data = database.users[target.id];
            if (!data) return interaction.reply({ embeds: [createErrorEmbed("User ini belum memiliki data di database.")], ephemeral: true });

            return interaction.reply({
                embeds: [createInfoEmbed(`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``, `🗄️ Data ${target.tag}`)],
                ephemeral: true
            });
        }

        if (sub === "deleteuser") {
            delete database.users[target.id];
            db.save();
            return interaction.reply({ embeds: [createSuccessEmbed(`Data ${target.tag} berhasil dihapus dari database.`)], ephemeral: true });
        }
    }
};
