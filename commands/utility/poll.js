const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Buat polling sederhana dengan reaksi 👍👎")
        .addStringOption((o) => o.setName("question").setDescription("Pertanyaan polling").setRequired(true)),
    async execute(interaction) {
        await interaction.reply({ embeds: [createInfoEmbed(interaction.options.getString("question"), `📊 Poll oleh ${interaction.user.username}`)] });
        const msg = await interaction.fetchReply();
        await msg.react("👍");
        await msg.react("👎");
    }
};
