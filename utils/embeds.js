const { EmbedBuilder } = require("discord.js");
const settings = require("../settings.js");

function baseEmbed(color) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: settings.botName })
        .setTimestamp();
}

function createSuccessEmbed(description, title = "✅ Berhasil") {
    return baseEmbed(settings.colors.success).setTitle(title).setDescription(description);
}

function createErrorEmbed(description, title = "❌ Terjadi Kesalahan") {
    return baseEmbed(settings.colors.error).setTitle(title).setDescription(description);
}

function createInfoEmbed(description, title = "ℹ️ Informasi") {
    return baseEmbed(settings.colors.primary).setTitle(title).setDescription(description);
}

function createWarningEmbed(description, title = "⚠️ Peringatan") {
    return baseEmbed(settings.colors.warning).setTitle(title).setDescription(description);
}

module.exports = {
    createSuccessEmbed,
    createErrorEmbed,
    createInfoEmbed,
    createWarningEmbed,
    baseEmbed
};
