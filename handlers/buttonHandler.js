const {
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createErrorEmbed, createSuccessEmbed, createInfoEmbed } = require("../utils/embeds.js");
const { isModerator } = require("../utils/permissions.js");
const logger = require("../utils/logger.js");
const { handleGameButton } = require("./gameButtonHandler.js");
const { handleMusicButton } = require("../utils/musicButtons.js");

async function handleButton(interaction, client) {
    const id = interaction.customId;

    if (id.startsWith("music_")) return handleMusicButton(interaction);

    if (id === "ticket_create" || (id.startsWith("ticket_") && db.getDB().tickets[interaction.channelId])) return require("../src/services/tickets/ticketService").handle(interaction);
    if (id === "ticket_close") return handleTicketClose(interaction, client);
    if (id === "ticket_transcript") return handleTicketTranscript(interaction, client);

    if (id.startsWith("broadcast_confirm_")) return handleBroadcastConfirm(interaction, client, id);
    if (id.startsWith("broadcast_cancel_")) return handleBroadcastCancel(interaction, id);

    if (id.startsWith("rps_")) return handleRps(interaction, id);
    if (id.startsWith("higherlower_")) return handleHigherLower(interaction, id);

    // Z-command games (Blackjack, Mines, HighLow, Hunt) — sistem baru, tidak mengganggu handler di atas.
    if (id.startsWith("zbj_") || id.startsWith("zmines_") || id.startsWith("zhl_") || id.startsWith("zhunt_") || id.startsWith("zmarry_") || id.startsWith("zboss_")) {
        return handleGameButton(interaction, client);
    }
}

// ---------------- TICKET SYSTEM ----------------

// Existing legacy ticket channels still allow staff close/transcript. New tickets use ticketService.
async function handleTicketClose(interaction, client) {
    if (!isModerator(interaction.member)) {
        return interaction.reply({
            embeds: [createErrorEmbed("Kamu tidak punya izin menutup ticket ini.")],
            ephemeral: true
        });
    }

    await interaction.reply({ embeds: [createInfoEmbed("Ticket akan ditutup dalam 5 detik...")] });
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (err) {
            logger.error(`Gagal menutup ticket: ${err.message}`);
        }
    }, 5000);
}

async function handleTicketTranscript(interaction, client) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = [...messages.values()].reverse();
        const lines = sorted.map(
            (m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`
        );
        const buffer = Buffer.from(lines.join("\n"), "utf8");
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

        await interaction.editReply({ content: "Transcript berhasil dibuat.", files: [attachment] });

        if (settings.ticket.transcriptChannelId) {
            const logChannel = await interaction.guild.channels.fetch(settings.ticket.transcriptChannelId).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [createInfoEmbed(`Transcript ticket ${interaction.channel.name}`, "📄 Transcript")],
                    files: [attachment]
                });
            }
        }
    } catch (err) {
        logger.error(`Gagal membuat transcript: ${err.message}`);
        await interaction.editReply({ content: "Gagal membuat transcript." }).catch(() => {});
    }
}

// ---------------- BROADCAST CONFIRM ----------------

async function handleBroadcastConfirm(interaction, client, id) {
    const { isOwner } = require("../utils/permissions.js");
    if (!isOwner(interaction.user.id)) {
        return interaction.reply({ embeds: [createErrorEmbed("Hanya owner yang bisa menggunakan ini.")], ephemeral: true });
    }

    const message = client.pendingBroadcasts?.get(id);
    if (!message) {
        return interaction.update({
            embeds: [createErrorEmbed("Broadcast ini sudah kedaluwarsa.")],
            components: []
        });
    }

    await interaction.update({ embeds: [createInfoEmbed("Mengirim broadcast ke semua server...")], components: [] });

    let success = 0;
    let failed = 0;
    for (const [, guild] of client.guilds.cache) {
        const guildConfig = db.getGuild(guild.id);
        const targetChannelId = guildConfig.logChannel || null;
        let targetChannel = null;
        if (targetChannelId) {
            targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
        }
        if (!targetChannel) {
            targetChannel = guild.channels.cache.find(
                (c) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)
            );
        }
        if (targetChannel) {
            try {
                await targetChannel.send({ embeds: [createInfoEmbed(message, "📣 Pengumuman dari Owner")] });
                success++;
            } catch {
                failed++;
            }
        } else {
            failed++;
        }
    }

    client.pendingBroadcasts.delete(id);
    await interaction.followUp({
        embeds: [createSuccessEmbed(`Broadcast selesai.\nBerhasil: ${success} server\nGagal: ${failed} server`)],
        ephemeral: true
    });
}

async function handleBroadcastCancel(interaction, id) {
    interaction.client.pendingBroadcasts?.delete(id);
    await interaction.update({ embeds: [createInfoEmbed("Broadcast dibatalkan.")], components: [] });
}

// ---------------- GAMES ----------------

const RPS_CHOICES = ["rock", "paper", "scissors"];
const RPS_EMOJI = { rock: "✊", paper: "✋", scissors: "✌️" };

function rpsWinner(user, bot) {
    if (user === bot) return "draw";
    if (
        (user === "rock" && bot === "scissors") ||
        (user === "paper" && bot === "rock") ||
        (user === "scissors" && bot === "paper")
    ) {
        return "user";
    }
    return "bot";
}

async function handleRps(interaction, id) {
    const [, choice, ownerId] = id.split("_");
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("Ini bukan game kamu!")], ephemeral: true });
    }

    const botChoice = RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)];
    const result = rpsWinner(choice, botChoice);

    let text;
    if (result === "draw") text = "Seri! 🤝";
    else if (result === "user") text = "Kamu menang! 🎉";
    else text = "Kamu kalah! 😢";

    await interaction.update({
        embeds: [
            createInfoEmbed(
                `Kamu: ${RPS_EMOJI[choice]} ${choice}\nBot: ${RPS_EMOJI[botChoice]} ${botChoice}\n\n**${text}**`,
                "✊✋✌️ Rock Paper Scissors"
            )
        ],
        components: []
    });
}

async function handleHigherLower(interaction, id) {
    const [, guess, ownerId, currentValue] = id.split("_");
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("Ini bukan game kamu!")], ephemeral: true });
    }

    const current = parseInt(currentValue, 10);
    const next = Math.floor(Math.random() * 100) + 1;
    const correct = (guess === "higher" && next > current) || (guess === "lower" && next < current);

    if (next === current) {
        return interaction.update({
            embeds: [createInfoEmbed(`Angka selanjutnya: **${next}** (sama!) Permainan berakhir seri.`)],
            components: []
        });
    }

    if (!correct) {
        return interaction.update({
            embeds: [createErrorEmbed(`Angka selanjutnya: **${next}**. Tebakanmu salah! Game over.`)],
            components: []
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`higherlower_higher_${ownerId}_${next}`).setLabel("⬆️ Higher").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`higherlower_lower_${ownerId}_${next}`).setLabel("⬇️ Lower").setStyle(ButtonStyle.Danger)
    );

    await interaction.update({
        embeds: [createSuccessEmbed(`Angka sekarang: **${next}**. Tebak lagi, lebih tinggi atau lebih rendah?`, "🔢 Higher or Lower")],
        components: [row]
    });
}

module.exports = { handleButton };
