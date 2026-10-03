const { createWarningEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");

module.exports = {
    name: "messageDelete",
    once: false,
    async execute(message) {
        try {
            if (!message.guild || message.author?.bot) return;
            if (!message.content && message.attachments.size === 0) return;

            await logger.sendLog(
                message.client,
                message.guild.id,
                createWarningEmbed(
                    `**Author:** ${message.author?.tag ?? "Unknown"}\n**Channel:** ${message.channel}\n**Konten:**\n${
                        message.content || "*[tidak ada teks / hanya attachment]*"
                    }`,
                    "🗑️ Message Deleted"
                )
            );
        } catch (err) {
            logger.error(`messageDelete error: ${err.message}`);
        }
    }
};
