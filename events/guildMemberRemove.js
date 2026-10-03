const { AttachmentBuilder } = require("discord.js");
const settings = require("../settings.js");
const db = require("../utils/database.js");
const { createInfoEmbed } = require("../utils/embeds.js");
const logger = require("../utils/logger.js");
const { generateCard } = require("../utils/welcomeCard.js");

module.exports = {
    name: "guildMemberRemove",
    once: false,
    async execute(member) {
        try {
            await require("../src/services/welcome/greetingService").sendGreeting(member, "goodbye");

            await logger.sendLog(
                member.client,
                member.guild.id,
                createInfoEmbed(
                    `**User:** ${member.user.tag}\n**Username:** ${member.user.username}\n**Member Count:** ${member.guild.memberCount}`,
                    "👋 Member Left"
                )
            );
        } catch (err) {
            logger.error(`guildMemberRemove error: ${err.message}`);
        }
    }
};
