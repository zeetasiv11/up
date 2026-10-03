const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/skip");
module.exports = {
    name: "skip",
    category: "music",
    description: "Skip music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
