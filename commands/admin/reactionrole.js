const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");
const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, baseEmbed } = require("../../utils/embeds.js");
const {
    parseEmojiInput,
    formatEmoji,
    getGuildReactionRoles,
    addMapping,
    removeMapping,
    emojiMatches
} = require("../../utils/reactionRoles.js");

/** Bangun ulang isi embed panel dari daftar mapping yang menempel di 1 pesan. */
function buildPanelEmbed(guild, title, description, entries) {
    const lines = entries.length
        ? entries.map((e) => `${formatEmoji(e)} — <@&${e.roleId}>`).join("\n")
        : "_Belum ada role yang ditambahkan._";

    return baseEmbed(settings.colors.primary)
        .setTitle(title || `🎭 Ambil Role — ${guild.name}`)
        .setDescription(
            `${description ? `${description}\n\n` : ""}React emote di bawah ini untuk mendapatkan role. React lagi emote yang sama untuk melepas role.\n\n${lines}`
        );
}

async function refreshPanelMessage(guild, channelId, messageId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return null;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return null;

    const entries = getGuildReactionRoles(guild.id).filter((e) => e.messageId === messageId);
    const oldEmbed = message.embeds[0];
    const newEmbed = buildPanelEmbed(guild, oldEmbed?.title, null, entries);
    await message.edit({ embeds: [newEmbed] }).catch(() => null);
    return message;
}

module.exports = {
    adminOnly: true,
    data: new SlashCommandBuilder()
        .setName("reactionrole")
        .setDescription("Atur sistem reaction role (react emote -> dapat role otomatis)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand((sub) =>
            sub
                .setName("panel")
                .setDescription("Buat pesan panel reaction role baru di sebuah channel")
                .addChannelOption((o) =>
                    o.setName("channel").setDescription("Channel untuk panel").addChannelTypes(ChannelType.GuildText).setRequired(true)
                )
                .addStringOption((o) => o.setName("judul").setDescription("Judul panel").setRequired(false))
                .addStringOption((o) => o.setName("deskripsi").setDescription("Deskripsi/instruksi tambahan").setRequired(false))
        )
        .addSubcommand((sub) =>
            sub
                .setName("add")
                .setDescription("Tambahkan pasangan emote -> role ke sebuah panel/pesan")
                .addStringOption((o) => o.setName("emote").setDescription("Emote (unicode atau custom emote server)").setRequired(true))
                .addRoleOption((o) => o.setName("role").setDescription("Role yang didapat saat react").setRequired(true))
                .addStringOption((o) => o.setName("message_id").setDescription("ID pesan panel (kosongkan = panel terakhir yang dibuat)").setRequired(false))
                .addChannelOption((o) =>
                    o.setName("channel").setDescription("Channel tempat pesan panel berada (kalau pakai message_id)").addChannelTypes(ChannelType.GuildText).setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("remove")
                .setDescription("Hapus pasangan emote -> role dari sebuah pesan")
                .addStringOption((o) => o.setName("emote").setDescription("Emote yang mau dihapus").setRequired(true))
                .addStringOption((o) => o.setName("message_id").setDescription("ID pesan panel (kosongkan = panel terakhir yang dibuat)").setRequired(false))
                .addChannelOption((o) =>
                    o.setName("channel").setDescription("Channel tempat pesan panel berada (kalau pakai message_id)").addChannelTypes(ChannelType.GuildText).setRequired(false)
                )
        )
        .addSubcommand((sub) => sub.setName("list").setDescription("Lihat semua reaction role yang aktif di server ini")),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        // ---------------- PANEL ----------------
        if (sub === "panel") {
            const channel = interaction.options.getChannel("channel");
            const judul = interaction.options.getString("judul");
            const deskripsi = interaction.options.getString("deskripsi");

            const perms = channel.permissionsFor(guild.members.me);
            if (!perms?.has(["SendMessages", "ViewChannel", "EmbedLinks", "AddReactions"])) {
                return interaction.reply({
                    embeds: [createErrorEmbed(`Bot tidak punya izin cukup untuk mengirim/react pesan di ${channel}.`)],
                    ephemeral: true
                });
            }

            const embed = buildPanelEmbed(guild, judul, deskripsi, []);
            const message = await channel.send({ embeds: [embed] });

            db.updateGuild(guild.id, { lastReactionRolePanel: { channelId: channel.id, messageId: message.id } });

            return interaction.reply({
                embeds: [
                    createSuccessEmbed(
                        `Panel reaction role dibuat di ${channel}.\n` +
                            `**Message ID:** \`${message.id}\`\n\n` +
                            `Lanjut pakai \`/reactionrole add\` untuk menambahkan emote + role ke panel ini (tidak perlu isi \`message_id\` kalau ini panel yang baru saja dibuat).`
                    )
                ]
            });
        }

        // ---------------- ADD ----------------
        if (sub === "add") {
            const emoteRaw = interaction.options.getString("emote");
            const role = interaction.options.getRole("role");
            let messageId = interaction.options.getString("message_id");
            let channel = interaction.options.getChannel("channel");

            const emoji = parseEmojiInput(emoteRaw);
            if (!emoji) {
                return interaction.reply({ embeds: [createErrorEmbed("Emote tidak valid. Gunakan emoji unicode (😀) atau custom emote server.")], ephemeral: true });
            }

            if (!messageId) {
                const lastPanel = db.getGuild(guild.id).lastReactionRolePanel;
                if (!lastPanel) {
                    return interaction.reply({
                        embeds: [createErrorEmbed("Belum ada panel yang dibuat. Buat dulu dengan `/reactionrole panel`, atau isi `message_id` & `channel` secara manual.")],
                        ephemeral: true
                    });
                }
                messageId = lastPanel.messageId;
                channel = channel || (await guild.channels.fetch(lastPanel.channelId).catch(() => null));
            }

            if (!channel) {
                return interaction.reply({ embeds: [createErrorEmbed("Channel tempat pesan itu berada tidak ditemukan. Isi opsi `channel` secara manual.")], ephemeral: true });
            }

            if (role.managed || role.id === guild.id) {
                return interaction.reply({ embeds: [createErrorEmbed("Role ini tidak bisa dipakai (role bawaan bot lain / @everyone).")], ephemeral: true });
            }
            if (guild.members.me.roles.highest.position <= role.position) {
                return interaction.reply({
                    embeds: [createErrorEmbed(`Role ${role} posisinya lebih tinggi atau sejajar dengan role tertinggi bot. Pindahkan role bot ke atas ${role} dulu.`)],
                    ephemeral: true
                });
            }

            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                return interaction.reply({ embeds: [createErrorEmbed(`Pesan dengan ID \`${messageId}\` tidak ditemukan di ${channel}.`)], ephemeral: true });
            }

            try {
                await message.react(emoji.raw);
            } catch (err) {
                return interaction.reply({ embeds: [createErrorEmbed(`Gagal menambahkan reaction ke pesan: ${err.message}`)], ephemeral: true });
            }

            addMapping(guild.id, {
                channelId: channel.id,
                messageId: message.id,
                emojiId: emoji.id,
                emojiName: emoji.name,
                emojiAnimated: emoji.animated,
                roleId: role.id,
                addedAt: Date.now()
            });

            await refreshPanelMessage(guild, channel.id, message.id);

            return interaction.reply({
                embeds: [createSuccessEmbed(`Sekarang react ${emoji.raw} di [pesan ini](${message.url}) akan memberikan role ${role}.`)]
            });
        }

        // ---------------- REMOVE ----------------
        if (sub === "remove") {
            const emoteRaw = interaction.options.getString("emote");
            let messageId = interaction.options.getString("message_id");
            let channel = interaction.options.getChannel("channel");

            const emoji = parseEmojiInput(emoteRaw);
            if (!emoji) {
                return interaction.reply({ embeds: [createErrorEmbed("Emote tidak valid.")], ephemeral: true });
            }

            if (!messageId) {
                const lastPanel = db.getGuild(guild.id).lastReactionRolePanel;
                if (!lastPanel) {
                    return interaction.reply({ embeds: [createErrorEmbed("Tidak ada panel default. Isi `message_id` & `channel` secara manual.")], ephemeral: true });
                }
                messageId = lastPanel.messageId;
                channel = channel || (await guild.channels.fetch(lastPanel.channelId).catch(() => null));
            }

            const removed = removeMapping(guild.id, messageId, { id: emoji.id, name: emoji.name });
            if (!removed) {
                return interaction.reply({ embeds: [createErrorEmbed("Tidak ditemukan mapping emote itu di pesan tersebut.")], ephemeral: true });
            }

            if (channel) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    await message.reactions.cache
                        .find((r) => (emoji.id ? r.emoji.id === emoji.id : r.emoji.name === emoji.name))
                        ?.remove()
                        .catch(() => null);
                    await refreshPanelMessage(guild, channel.id, messageId);
                }
            }

            return interaction.reply({ embeds: [createSuccessEmbed(`Reaction role untuk emote ${emoji.raw} berhasil dihapus.`)] });
        }

        // ---------------- LIST ----------------
        if (sub === "list") {
            const entries = getGuildReactionRoles(guild.id);
            if (!entries.length) {
                return interaction.reply({ embeds: [createInfoEmbed("Belum ada reaction role yang diatur di server ini.", "🎭 Reaction Role")] });
            }

            const grouped = new Map();
            for (const e of entries) {
                if (!grouped.has(e.messageId)) grouped.set(e.messageId, { channelId: e.channelId, items: [] });
                grouped.get(e.messageId).items.push(e);
            }

            let description = "";
            for (const [messageId, data] of grouped) {
                description += `**Channel:** <#${data.channelId}> • **Pesan:** \`${messageId}\`\n`;
                description += data.items.map((e) => `> ${formatEmoji(e)} — <@&${e.roleId}>`).join("\n");
                description += "\n\n";
            }

            return interaction.reply({ embeds: [createInfoEmbed(description.trim(), "🎭 Reaction Role Aktif")] });
        }
    }
};
