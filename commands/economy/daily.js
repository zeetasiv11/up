const { SlashCommandBuilder } = require("discord.js");
const reward = require("../../services/economy/rewardCommand.js");
module.exports = {
    data: new SlashCommandBuilder().setName("daily").setDescription("Klaim reward daily"),
    execute: (interaction) => reward.execute(interaction, "daily")
};
