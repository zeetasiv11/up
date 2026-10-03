/**
 * ============================================
 *  HUNT CONTROLLER
 *  zhunt -> encounter random (animal/coin/xp/crate/nothing).
 *  Kalau animal: tampilkan tombol CATCH/RUN.
 * ============================================
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const economy = require("../../economy/economyService.js");
const questService = require("../../quest/questService.js");
const animalService = require("../../animals/animalService.js");
const { rollAnimalByRarity, RARITY, HUNT_LOCATIONS } = require("../../../data/animals.js");
const sessionManager = require("../sessionManager.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const TIMEOUT_MS = 20 * 1000;
const CATCH_CHANCE = 0.7;

function buildRow(gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`zhunt_catch_${gameId}`).setLabel("CATCH").setEmoji("🎯").setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`zhunt_run_${gameId}`).setLabel("RUN").setEmoji("🏃").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );
}

function recordHunt(userId) {
    const user = db.getUser(userId);
    const stats = user.stats || { huntCount: 0, cratesOpened: 0 };
    stats.huntCount = (stats.huntCount || 0) + 1;
    db.updateUser(userId, { stats });
    questService.progressQuest(userId, "hunt", 1);
}

async function startHunt(message, userId) {
    const location = HUNT_LOCATIONS[Math.floor(Math.random() * HUNT_LOCATIONS.length)];
    const outcome = animalService.rollHuntOutcome();

    if (outcome.type === "coin") {
        recordHunt(userId);
        economy.addBalance(userId, outcome.amount);
        questService.progressQuest(userId, "earn_coins", outcome.amount);
        return message.reply({ embeds: [createSuccessEmbed(`Kamu pergi ke ${location} dan menemukan **${outcome.amount.toLocaleString("id-ID")}** ${settings.economy.currencyIcon} di tanah!`, "🌲 HUNTING")] });
    }

    if (outcome.type === "xp") {
        recordHunt(userId);
        const user = db.getUser(userId);
        db.updateUser(userId, { xp: (user.xp || 0) + outcome.amount });
        return message.reply({ embeds: [createSuccessEmbed(`Kamu pergi ke ${location} dan mendapatkan **${outcome.amount} XP** dari pengalaman berburu!`, "🌲 HUNTING")] });
    }

    if (outcome.type === "crate") {
        recordHunt(userId);
        const { addItem } = require("../../inventory/inventoryService.js");
        addItem(userId, "crate_basic", 1);
        return message.reply({ embeds: [createSuccessEmbed(`Kamu pergi ke ${location} dan menemukan sebuah **Basic Crate** 🎁! Cek \`zinventory\`.`, "🌲 HUNTING")] });
    }

    if (outcome.type === "nothing") {
        recordHunt(userId);
        return message.reply({ embeds: [createInfoEmbed(`Kamu pergi ke ${location} tapi tidak menemukan apa-apa. Coba lagi nanti!`, "🌲 HUNTING")] });
    }

    // outcome.type === "animal"
    const template = rollAnimalByRarity(outcome.rarity);
    const rarityInfo = RARITY[outcome.rarity];

    const session = sessionManager.createSession("hunt", userId, { animalId: template.id }, TIMEOUT_MS, async (s) => {
        message.channel.send({ content: `<@${s.ownerId}>`, embeds: [createInfoEmbed(`⏳ **${template.name}** kabur karena kamu terlalu lama memutuskan.`, "🌲 HUNTING")] }).catch(() => {});
    });

    if (!session) {
        return message.reply({ embeds: [createErrorEmbed("❌ Kamu masih punya sesi hunting yang berjalan.")] });
    }

    const sent = await message.reply({
        embeds: [createInfoEmbed(
            `Kamu pergi ke ${location}...\n\n${rarityInfo.emoji} **${template.emoji} ${template.name}** (${rarityInfo.label}) muncul!`,
            "🌲 HUNTING"
        )],
        components: [buildRow(session.id)]
    });
    await sessionManager.bindMessage(session, sent);
}

async function handleButton(interaction, action, gameId) {
    const session = sessionManager.getSession(gameId);
    if (!session) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ This game has already ended.")], ephemeral: true });
    }
    if (interaction.user.id !== session.ownerId) {
        return interaction.reply({ embeds: [createErrorEmbed("❌ This game belongs to another player.")], ephemeral: true });
    }

    sessionManager.endSession(gameId);
    recordHunt(session.ownerId);
    const template = require("../../../data/animals.js").getAnimal(session.data.animalId);

    if (action === "run") {
        return interaction.update({
            embeds: [createInfoEmbed(`Kamu memutuskan kabur dari **${template.name}**.`, "🌲 HUNTING")],
            components: [buildRow(gameId, true)]
        });
    }

    const caught = Math.random() < CATCH_CHANCE;
    logger.info(`[HUNT] ${session.ownerId} attempt catch=${template.id} success=${caught}`);

    if (!caught) {
        return interaction.update({
            embeds: [createInfoEmbed(`**${template.name}** berhasil kabur sebelum kamu menangkapnya!`, "🌲 HUNTING")],
            components: [buildRow(gameId, true)]
        });
    }

    animalService.addAnimal(session.ownerId, template.id);
    await interaction.update({
        embeds: [createSuccessEmbed(`Kamu berhasil menangkap **${template.emoji} ${template.name}**! Cek koleksimu dengan \`zanimals\`.`, "🌲 HUNTING")],
        components: [buildRow(gameId, true)]
    });
}

module.exports = { startHunt, handleButton };
