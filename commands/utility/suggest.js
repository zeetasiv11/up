const { SlashCommandBuilder } = require("discord.js");
const { createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("suggest")
        .setDescription("Kirim saran untuk server ini")
        .addStringOption((o) => o.setName("suggestion").setDescription("Saranmu").setRequired(true)),
    async execute(interaction) {
        await interaction.reply({ embeds: [createSuccessEmbed("Saranmu telah dikirim!")], ephemeral: true });
        const msg = await interaction.channel.send({
            embeds: [createInfoEmbed(interaction.options.getString("suggestion"), `💡 Saran dari ${interaction.user.username}`)]
        });
        await msg.react("👍");
        await msg.react("👎");
    }
};
