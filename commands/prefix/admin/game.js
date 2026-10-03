const db = require("../../../utils/database.js");
const { getRegistry } = require("../../../handlers/prefixCommandHandler.js");
const { isAdmin } = require("../../../utils/permissions.js");
const { createSuccessEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

module.exports = {
    name: "game",
    aliases: [],
    category: "admin",
    description: "[ADMIN] Enable/disable game tertentu di server ini",
    usage: "zgame enable|disable <gameName>",
    async execute(message, args) {
        if (!isAdmin(message.member)) {
            return message.reply({ embeds: [createErrorEmbed("❌ Command ini khusus Administrator/Owner.")] });
        }

        const sub = (args[0] || "").toLowerCase();
        const gameName = (args[1] || "").toLowerCase();

        if (!["enable", "disable"].includes(sub) || !gameName) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zgame enable|disable <gameName>`\nContoh: `zgame disable blackjack`")] });
        }

        const registry = getRegistry();
        const command = registry.get(gameName);
        if (!command || command.category !== "games") {
            return message.reply({ embeds: [createErrorEmbed(`❌ \`${gameName}\` bukan nama game yang valid.`)] });
        }

        const guildData = db.getGuild(message.guild.id);
        const disabled = new Set(guildData.disabledGames || []);

        if (sub === "disable") disabled.add(gameName);
        else disabled.delete(gameName);

        db.updateGuild(message.guild.id, { disabledGames: [...disabled] });
        logger.game(`Admin ${message.author.id} ${sub} game ${gameName} di guild ${message.guild.id}`);

        await message.reply({
            embeds: [createSuccessEmbed(`Game **${gameName}** berhasil di-**${sub}** untuk server ini.`, "🛠️ GAME SETTINGS")]
        });
    }
};
