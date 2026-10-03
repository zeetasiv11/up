const { createInfoEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");

module.exports = {
    name: "messageUpdate",
    once: false,
    async execute(oldMessage, newMessage) {
        try {
            if (!newMessage.guild || newMessage.author?.bot) return;
            if (oldMessage.content === newMessage.content) return;

            await logger.sendLog(
                newMessage.client,
                newMessage.guild.id,
                createInfoEmbed(
                    `**Author:** ${newMessage.author?.tag ?? "Unknown"}\n**Channel:** ${newMessage.channel}\n` +
                        `**Sebelum:**\n${oldMessage.content || "*kosong*"}\n\n**Sesudah:**\n${newMessage.content || "*kosong*"}`,
                    "✏️ Message Edited"
                )
            );
        } catch (err) {
            logger.error(`messageUpdate error: ${err.message}`);
        }
    }
};
