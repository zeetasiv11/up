const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/queue");
module.exports = {
    name: "queue",
    category: "music",
    description: "Queue music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
