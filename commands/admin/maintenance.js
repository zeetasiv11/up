const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/database");
const settings = require("../../settings.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");


module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("maintenance")
        .setDescription("Aktif/nonaktifkan mode maintenance (owner only)")
        .addSubcommand((sub) => sub.setName("on").setDescription("Aktifkan maintenance mode"))
        .addSubcommand((sub) => sub.setName("off").setDescription("Nonaktifkan maintenance mode")),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        settings.maintenance.enabled = sub === "on";
        db.getDB().stats.maintenance = settings.maintenance.enabled;
        await db.save();

        await interaction.reply({
            embeds: [createSuccessEmbed(`Maintenance mode telah **${sub === "on" ? "diaktifkan" : "dinonaktifkan"}**.`)]
        });
    }
};
