/**
 * ============================================
 *  MARRIAGE CONTROLLER
 *  zpropose/zmarry @user -> button ACCEPT/DECLINE.
 * ============================================
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../utils/embeds.js");

const pendingProposals = new Map(); // `${proposerId}_${targetId}` -> timeout handle

function isMarried(userId) {
    const user = db.getUser(userId);
    return !!user.marriage?.partnerId;
}

async function propose(message, proposerId, targetId) {
    if (proposerId === targetId) {
        return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak bisa melamar dirimu sendiri.")] });
    }
    if (isMarried(proposerId)) {
        return message.reply({ embeds: [createErrorEmbed("❌ Kamu sudah menikah. Gunakan `zdivorce` dulu.")] });
    }
    if (isMarried(targetId)) {
        return message.reply({ embeds: [createErrorEmbed("❌ Orang itu sudah menikah dengan orang lain.")] });
    }

    const key = `${proposerId}_${targetId}`;
    if (pendingProposals.has(key)) {
        return message.reply({ embeds: [createErrorEmbed("❌ Kamu sudah punya lamaran tertunda ke orang ini.")] });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`zmarry_accept_${proposerId}_${targetId}`).setLabel("ACCEPT").setEmoji("💍").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`zmarry_decline_${proposerId}_${targetId}`).setLabel("DECLINE").setEmoji("💔").setStyle(ButtonStyle.Danger)
    );

    const timeout = setTimeout(() => pendingProposals.delete(key), 60 * 1000);
    pendingProposals.set(key, timeout);

    await message.reply({
        content: `<@${targetId}>`,
        embeds: [createInfoEmbed(`<@${proposerId}> melamar <@${targetId}>! 💍\n\nApakah kamu menerima?`, "💍 MARRIAGE PROPOSAL")],
        components: [row]
    });
}

async function handleButton(interaction, action, proposerId, targetId) {
    const key = `${proposerId}_${targetId}`;
    if (!pendingProposals.has(key)) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Lamaran ini sudah kedaluwarsa.")], ephemeral: true });
    }
    if (interaction.user.id !== targetId) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ Hanya orang yang dilamar yang bisa merespon.")], ephemeral: true });
    }

    clearTimeout(pendingProposals.get(key));
    pendingProposals.delete(key);

    if (action === "decline") {
        return interaction.update({ embeds: [createInfoEmbed("Lamaran ditolak. 💔", "💍 MARRIAGE PROPOSAL")], components: [] });
    }

    if (isMarried(proposerId) || isMarried(targetId)) {
        return interaction.update({ embeds: [createErrorEmbed("❌ Salah satu pihak sudah menikah duluan.")], components: [] });
    }

    const now = Date.now();
    db.updateUser(proposerId, { marriage: { partnerId: targetId, marriedAt: now } });
    db.updateUser(targetId, { marriage: { partnerId: proposerId, marriedAt: now } });

    await interaction.update({
        embeds: [createSuccessEmbed(`<@${proposerId}> dan <@${targetId}> resmi menikah! 🎉💍`, "💍 MARRIED!")],
        components: []
    });
}

module.exports = { propose, handleButton, isMarried };
