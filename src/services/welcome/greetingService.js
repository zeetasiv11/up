const {
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const db = require("../../../utils/database");
const defaults = require("../../../settings");
const { generateCard } = require("../../../utils/welcomeCard");
const logger = require("../../../utils/logger");
function expand(template, member) {
    const variables = {
        user: `<@${member.id}>`,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
        server: member.guild.name,
        memberCount: String(member.guild.memberCount),
        userId: member.id,
        serverId: member.guild.id,
        createdAt: member.user.createdAt?.toISOString().slice(0, 10) || "",
    };
    return String(template || "").replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
}
function configuration(member, type) {
    const data = db.getGuild(member.guild.id);
    const legacy = defaults[type];
    return {
        ...legacy,
        title: type === "welcome" ? "Welcome to {server}" : "Until next time, {username}",
        description: "",
        color: "#b7a4ef",
        thumbnail: true,
        channelId: data[`${type}Channel`] || legacy.channelId,
        ...data[type],
    };
}
function buildPayload(member, config) {
    const embed = new EmbedBuilder().setColor(/^#[\da-f]{6}$/i.test(config.color) ? config.color : "#b7a4ef");
    const title = expand(config.title, member).slice(0, 256),
        description = expand(config.description, member).slice(0, 4096);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (config.thumbnail) embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
    if (/^https:\/\//.test(config.image)) embed.setImage(config.image);
    embed.setFooter({ text: `${member.guild.name} · ${member.guild.memberCount.toLocaleString()} members` });
    const payload = {
        content: expand(config.message, member).slice(0, 2000) || undefined,
        embeds: [embed],
        allowedMentions: { parse: [], users: [member.id] },
    };
    if (config.buttonLabel && /^https:\/\//.test(config.buttonUrl))
        payload.components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(config.buttonLabel.slice(0, 80))
                    .setURL(config.buttonUrl),
            ),
        ];
    return payload;
}
async function sendGreeting(member, type) {
    const config = configuration(member, type);
    if (!config.enabled) return;
    const payload = buildPayload(member, config);
    if (config.useCard && !config.image) {
        const card = await generateCard(member, type === "welcome" ? "join" : "leave");
        if (card) {
            payload.files = [new AttachmentBuilder(card, { name: `${type}.png` })];
            payload.embeds[0].setImage(`attachment://${type}.png`);
        }
    }
    if (config.channelId) {
        try {
            const channel = await member.guild.channels.fetch(config.channelId);
            if (channel?.isTextBased()) await channel.send(payload);
        } catch (error) {
            logger.warn("Greeting delivery failed", {
                service: "greeting",
                guild: member.guild.id,
                error: error.message,
            });
        }
    }
    if (type === "welcome" && config.dm)
        await member
            .send(payload)
            .catch(() =>
                logger.info("Member DMs unavailable", { service: "greeting", guild: member.guild.id }),
            );
}
module.exports = { expand, configuration, buildPayload, sendGreeting };
