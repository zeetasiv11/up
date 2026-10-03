const { SlashCommandBuilder } = require("discord.js");
const { requireQueue } = require("../../utils/musicChecks.js");
const { sendQueueList } = require("../../utils/musicButtons.js");
module.exports = {
    data: new SlashCommandBuilder().setName("queue").setDescription("Lihat antrian musik dengan pagination"),
    category: "music",
    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (queue) return sendQueueList(interaction, queue);
    }
};
