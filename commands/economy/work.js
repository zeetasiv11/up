const { SlashCommandBuilder } = require("discord.js");
const reward = require("../../services/economy/rewardCommand.js");
module.exports = {
    data: new SlashCommandBuilder().setName("work").setDescription("Klaim reward work"),
    execute: (interaction) => reward.execute(interaction, "work")
};
