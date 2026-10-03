const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/stop");
module.exports = {
    name: "stop",
    category: "music",
    description: "Stop music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
