const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const settings = require("../../settings.js");

module.exports = {
    adminOnly: true,
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Kirim pengumuman resmi di channel ini")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((o) => o.setName("title").setDescription("Judul pengumuman").setRequired(true))
        .addStringOption((o) => o.setName("description").setDescription("Isi pengumuman").setRequired(true))
        .addStringOption((o) => o.setName("image").setDescription("URL gambar (opsional)"))
        .addRoleOption((o) => o.setName("mention").setDescription("Role yang akan di-mention (opsional)"))
        .addStringOption((o) => o.setName("footer").setDescription("Footer text (opsional)")),
    async execute(interaction) {
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        const image = interaction.options.getString("image");
        const mentionRole = interaction.options.getRole("mention");
        const footer = interaction.options.getString("footer");

        const embed = new EmbedBuilder()
            .setColor(settings.colors.primary)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: footer || settings.botName });

        if (image) embed.setImage(image);

        await interaction.channel.send({
            content: mentionRole ? `${mentionRole}` : undefined,
            embeds: [embed]
        });

        await interaction.reply({ content: "Pengumuman berhasil dikirim.", ephemeral: true });
    }
};
