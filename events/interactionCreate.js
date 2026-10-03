const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createErrorEmbed, createWarningEmbed } = require("../utils/embeds.js");
const { isOwner, isAdmin, isModerator } = require("../utils/permissions.js");
const logger = require("../utils/logger.js");
const { handleButton } = require("../handlers/buttonHandler.js");
const { handleSelectMenu } = require("../handlers/selectMenuHandler.js");

const { checkCooldown: consumeCooldown } = require("../services/game/cooldownManager.js");
function checkCooldown(userId, commandName, seconds) {
    return consumeCooldown(`slash:${commandName}`, userId, seconds * 1000);
}

module.exports = {
    name: "interactionCreate",
    once: false,
    async execute(interaction, client) {
        try {
            const musicAction = fn => client.music
                ? client.music.withMember(interaction.member, fn) : fn();
            require("../src/bot/middleware/persistenceBarrier").persistenceBarrier(interaction);
            const denied = require("../src/bot/middleware/accessPolicy.js").accessError(interaction.user.id, interaction.guildId);
            if (denied) return await interaction.reply({ embeds: [createErrorEmbed(denied)], ephemeral: true });
            if (!interaction.guildId) return await interaction.reply({ content: "Gunakan bot di dalam server.", ephemeral: true });
            // ---------- BUTTON ----------
            if (interaction.isButton()) {
                return await musicAction(() => handleButton(interaction, client));
            }

            // ---------- SELECT MENU ----------
            if (interaction.isStringSelectMenu()) {
                return await musicAction(() => handleSelectMenu(interaction, client));
            }

            // ---------- MODAL ----------
            if (interaction.isModalSubmit()) {
                if (interaction.customId === "music_volume_submit") return await musicAction(() => require("../utils/musicButtons.js").handleMusicModal(interaction));
                return; // Modal-modal spesifik ditangani langsung di command yang membuatnya (collector).
            }

            // ---------- SLASH COMMAND ----------
            if (!interaction.isChatInputCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            const userId = interaction.user.id;

            // Permission check
            if (command.ownerOnly && !isOwner(userId)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Owner bot.")],
                    ephemeral: true
                });
            }
            if (command.adminOnly && !isAdmin(interaction.member)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Administrator.")],
                    ephemeral: true
                });
            }
            if (command.modOnly && !isModerator(interaction.member)) {
                return interaction.reply({
                    embeds: [createErrorEmbed("Command ini hanya bisa digunakan oleh Moderator.")],
                    ephemeral: true
                });
            }

            const required = command.data.toJSON().default_member_permissions;
            if (required && !interaction.memberPermissions?.has(BigInt(required))) return interaction.reply({
                content: "Permission Discord kamu tidak mencukupi untuk command ini.", ephemeral: true
            });

            // Cooldown check
            const cooldownSeconds = command.cooldown ?? settings.cooldowns.defaultCommandCooldown;
            const remaining = checkCooldown(userId, command.data.name, cooldownSeconds);
            if (remaining > 0) {
                return interaction.reply({
                    embeds: [createWarningEmbed(`Tunggu **${remaining.toFixed(1)}s** lagi sebelum menggunakan command ini.`)],
                    ephemeral: true
                });
            }

            // Execute
            if (command.category === "music") await musicAction(() => command.execute(interaction, client));
            else await command.execute(interaction, client);

            const database = db.getDB();
            database.stats.commandsUsed = (database.stats.commandsUsed || 0) + 1;
            db.save();
        } catch (err) {
            logger.error(`interactionCreate error: ${err.stack || err.message}`);
            const errorEmbed = createErrorEmbed("Terjadi kesalahan saat menjalankan command ini.");
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
                }
            } catch {
                // Interaksi mungkin sudah expired — abaikan.
            }
        }
    }
};
