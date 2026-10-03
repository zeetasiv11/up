const reward = require("../../../services/economy/rewardCommand.js");
module.exports = {
    name: "work", aliases: [], category: "economy", description: "Klaim reward work", usage: "zwork",
    execute: (message) => reward.execute(message, "work")
};
