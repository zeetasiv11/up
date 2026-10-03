const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Lihat avatar seorang user")
        .addUserOption((o) => o.setName("user").setDescription("User yang ingin dilihat avatarnya")),
    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        await interaction.reply({
            embeds: [createInfoEmbed(" ", `🖼️ Avatar ${target.username}`).setImage(target.displayAvatarURL({ dynamic: true, size: 512 }))]
        });
    }
};
