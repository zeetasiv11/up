const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/pause");
module.exports = {
    name: "pause",
    category: "music",
    description: "Pause music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
