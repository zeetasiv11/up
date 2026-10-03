const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createInfoEmbed } = require("../../utils/embeds.js");

module.exports = {
    adminOnly: true,
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Konfigurasi fitur bot untuk server ini")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub.setName("welcome").setDescription("Atur channel welcome message")
                .addChannelOption((o) => o.setName("channel").setDescription("Channel welcome").addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("goodbye").setDescription("Atur channel goodbye message")
                .addChannelOption((o) => o.setName("channel").setDescription("Channel goodbye").addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("autorole").setDescription("Atur role otomatis untuk member baru")
                .addRoleOption((o) => o.setName("role").setDescription("Role yang diberikan otomatis").setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("logs").setDescription("Atur channel log server")
                .addChannelOption((o) => o.setName("channel").setDescription("Channel log").addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((sub) =>
            sub.setName("leveling").setDescription("Aktif/nonaktifkan sistem leveling")
                .addBooleanOption((o) => o.setName("enabled").setDescription("Aktifkan leveling?").setRequired(true))
        )
        .addSubcommand((sub) => sub.setName("view").setDescription("Lihat konfigurasi server saat ini")),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === "welcome") {
            const channel = interaction.options.getChannel("channel");
            db.updateGuild(guildId, { welcomeChannel: channel.id });
            return interaction.reply({ embeds: [createSuccessEmbed(`Welcome channel diatur ke ${channel}.`)] });
        }
        if (sub === "goodbye") {
            const channel = interaction.options.getChannel("channel");
            db.updateGuild(guildId, { goodbyeChannel: channel.id });
            return interaction.reply({ embeds: [createSuccessEmbed(`Goodbye channel diatur ke ${channel}.`)] });
        }
        if (sub === "autorole") {
            const role = interaction.options.getRole("role");
            db.updateGuild(guildId, { autoRole: role.id });
            return interaction.reply({ embeds: [createSuccessEmbed(`Auto-role diatur ke ${role}.`)] });
        }
        if (sub === "logs") {
            const channel = interaction.options.getChannel("channel");
            db.updateGuild(guildId, { logChannel: channel.id });
            return interaction.reply({ embeds: [createSuccessEmbed(`Log channel diatur ke ${channel}.`)] });
        }
        if (sub === "leveling") {
            const enabled = interaction.options.getBoolean("enabled");
            db.updateGuild(guildId, { leveling: enabled });
            return interaction.reply({ embeds: [createSuccessEmbed(`Sistem leveling ${enabled ? "diaktifkan" : "dinonaktifkan"}.`)] });
        }
        if (sub === "view") {
            const config = db.getGuild(guildId);
            return interaction.reply({
                embeds: [
                    createInfoEmbed(
                        `**Welcome Channel:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : "Belum diatur"}\n` +
                            `**Goodbye Channel:** ${config.goodbyeChannel ? `<#${config.goodbyeChannel}>` : "Belum diatur"}\n` +
                            `**Auto Role:** ${config.autoRole ? `<@&${config.autoRole}>` : "Belum diatur"}\n` +
                            `**Log Channel:** ${config.logChannel ? `<#${config.logChannel}>` : "Belum diatur"}\n` +
                            `**Leveling:** ${config.leveling ? "Aktif" : "Nonaktif"}\n` +
                            `**Reaction Role:** ${config.reactionRoles?.length || 0} emote-role aktif (\`/reactionrole list\`)`,
                        "⚙️ Konfigurasi Server"
                    )
                ]
            });
        }
    }
};
