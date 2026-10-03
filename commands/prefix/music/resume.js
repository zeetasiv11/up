const { prefixInteraction } = require("../../../src/bot/PrefixInteraction");
const command = require("../../music/resume");
module.exports = {
    name: "resume",
    category: "music",
    description: "Resume music",
    async execute(message, args) {
        return command.execute(prefixInteraction(message, args), message.client);
    },
};
