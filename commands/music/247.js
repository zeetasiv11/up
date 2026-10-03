const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../../utils/embeds.js");
const db = require("../../utils/database.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("247")
        .setDescription("Mode 24/7: bot tetap standby di voice channel walau kosong/antrian habis")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) => sub.setName("on").setDescription("Aktifkan mode 24/7"))
        .addSubcommand((sub) => sub.setName("off").setDescription("Matikan mode 24/7"))
        .addSubcommand((sub) => sub.setName("status").setDescription("Lihat status mode 24/7 di server ini")),
    category: "music",
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildData = db.getGuild(interaction.guildId);

        if (sub === "status") {
            return interaction.reply({
                embeds: [
                    createInfoEmbed(
                        guildData.musicMode247
                            ? "Mode 24/7 sedang **aktif** di server ini — bot tidak akan auto-leave walau voice channel kosong atau antrian habis."
                            : "Mode 24/7 sedang **nonaktif** di server ini — bot pakai perilaku normal (`leaveOnEmpty`/`leaveOnFinish` sesuai `settings.js`).",
                        "♾️ Status Mode 24/7"
                    )
                ]
            });
        }

        const enable = sub === "on";
        if (guildData.musicMode247 === enable) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Mode 24/7 memang sudah **${enable ? "aktif" : "nonaktif"}**.`)],
                ephemeral: true
            });
        }

        db.updateGuild(interaction.guildId, { musicMode247: enable });

        return interaction.reply({
            embeds: [
                createSuccessEmbed(
                    enable
                        ? "Mode 24/7 **diaktifkan**. Bot sekarang tidak akan otomatis keluar dari voice channel walau ditinggal sendirian atau antrian musik sudah habis, cocok buat dijadiin radio server. Nonaktifkan lagi kapan saja dengan `/247 off`, atau bot tetap bisa dikeluarkan manual lewat tombol Stop/Disconnect di panel musik, atau `/leave`."
                        : "Mode 24/7 **dinonaktifkan**. Bot kembali pakai perilaku normal (auto-leave sesuai `settings.js`).",
                    enable ? "♾️ Mode 24/7 Aktif" : "♾️ Mode 24/7 Nonaktif"
                )
            ]
        });
    }
};
