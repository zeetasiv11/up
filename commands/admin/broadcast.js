const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require("discord.js");
const { createWarningEmbed } = require("../../utils/embeds.js");

module.exports = {
    ownerOnly: true,
    cooldown: 30,
    data: new SlashCommandBuilder()
        .setName("broadcast")
        .setDescription("Kirim pengumuman ke semua server yang menggunakan bot (owner only)")
        .addStringOption((o) => o.setName("message").setDescription("Pesan yang ingin di-broadcast").setRequired(true)),
    async execute(interaction, client) {
        const message = interaction.options.getString("message");
        const id = `${interaction.user.id}_${Date.now()}`;

        if (!client.pendingBroadcasts) client.pendingBroadcasts = new Collection();
        client.pendingBroadcasts.set(id, message);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`broadcast_confirm_${id}`).setLabel("Confirm").setEmoji("✅").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`broadcast_cancel_${id}`).setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            embeds: [
                createWarningEmbed(
                    `Pesan ini akan dikirim ke **${client.guilds.cache.size} server**:\n\n"${message}"\n\nApakah kamu yakin?`,
                    "📣 Konfirmasi Broadcast"
                )
            ],
            components: [row],
            ephemeral: true
        });
    }
};
