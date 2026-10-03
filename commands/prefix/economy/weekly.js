const reward = require("../../../services/economy/rewardCommand.js");
module.exports = {
    name: "weekly", aliases: [], category: "economy", description: "Klaim reward weekly", usage: "zweekly",
    execute: (message) => reward.execute(message, "weekly")
};
