const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../utils/embeds.js");
const db = require("../../utils/database.js");
const { startGuard, stopGuard } = require("../../utils/voiceGuard.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vcguard")
        .setDescription("Bot bertahan (join & auto-reconnect) di voice channel tertentu, bisa berjam-jam/berhari-hari")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
            sub
                .setName("on")
                .setDescription("Aktifkan mode jaga voice channel")
                .addChannelOption((o) =>
                    o
                        .setName("channel")
                        .setDescription("Voice channel yang mau dijaga bot")
                        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) => sub.setName("off").setDescription("Matikan mode jaga voice channel")),
    category: "music",
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "off") {
            const wasActive = await stopGuard(interaction.guildId);
            db.updateGuild(interaction.guildId, { vcGuard: { enabled: false, channelId: "", textChannelId: "" } });

            return interaction.reply({
                embeds: [
                    createSuccessEmbed(
                        wasActive ? "Mode jaga voice channel dimatikan, bot sudah keluar." : "Mode jaga voice channel memang belum aktif.",
                        "🛑 VC Guard"
                    )
                ]
            });
        }

        const channel = interaction.options.getChannel("channel", true);
        const botMember = interaction.guild.members.me;
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(["Connect", "Speak"])) {
            return interaction.reply({
                embeds: [createErrorEmbed("Bot tidak punya izin **Connect** dan **Speak** di channel itu!")],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            await startGuard(interaction.guild, channel.id, interaction.channelId);
            db.updateGuild(interaction.guildId, {
                vcGuard: { enabled: true, channelId: channel.id, textChannelId: interaction.channelId }
            });

            await interaction.editReply({
                embeds: [
                    createSuccessEmbed(
                        `Bot sekarang standby di <#${channel.id}> dan bakal auto-reconnect kalau tiba-tiba terputus (network drop, di-kick, dsb) — bisa jalan berhari-hari selama proses bot tidak mati. Pakai \`/vcguard off\` buat matikan.`,
                        "🛡️ VC Guard Aktif"
                    )
                ]
            });
        } catch (err) {
            await interaction.editReply({
                embeds: [
                    createErrorEmbed(
                        `Gagal join voice channel dalam 30 detik: \`${err.message || err}\`\n` +
                            "Ini biasanya bukan soal kode, tapi UDP voice yang diblokir/dibatasi di sisi hosting. Cek panduan debug UDP yang dikirim bareng file ini.",
                        "❌ VC Guard Gagal Aktif"
                    )
                ]
            });
        }
    }
};
