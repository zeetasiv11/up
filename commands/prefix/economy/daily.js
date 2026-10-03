const reward = require("../../../services/economy/rewardCommand.js");
module.exports = {
    name: "daily", aliases: [], category: "economy", description: "Klaim reward daily", usage: "zdaily",
    execute: (message) => reward.execute(message, "daily")
};
