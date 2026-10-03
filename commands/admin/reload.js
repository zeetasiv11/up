const { SlashCommandBuilder } = require("discord.js");
const { loadCommands, registerCommands } = require("../../handlers/commandHandler.js");
const { loadEvents } = require("../../handlers/eventHandler.js");
const { createSuccessEmbed } = require("../../utils/embeds.js");

module.exports = {
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName("reload")
        .setDescription("Reload command atau event tanpa restart bot (owner only)")
        .addSubcommand((sub) => sub.setName("commands").setDescription("Reload semua slash command"))
        .addSubcommand((sub) => sub.setName("events").setDescription("Reload semua event listener")),
    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        if (sub === "commands") {
            loadCommands(client);
            await registerCommands(client);
            return interaction.editReply({ embeds: [createSuccessEmbed(`Berhasil reload ${client.commands.size} command.`)] });
        }
        if (sub === "events") {
            loadEvents(client);
            return interaction.editReply({ embeds: [createSuccessEmbed("Berhasil reload semua event listener.")] });
        }
    }
};
