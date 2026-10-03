const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/play");
module.exports = {
    name: "play",
    category: "music",
    description: "Play music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
