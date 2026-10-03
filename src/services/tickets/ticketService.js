const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require("discord.js");
const db = require("../../../utils/database"),
    defaults = require("../../../settings"),
    logger = require("../../../utils/logger");
const locks = new Map();
const config = (id) => ({ ...defaults.ticket, autoCloseHours: 0, ...db.getGuild(id).ticket });
const controls = (closed) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Claim")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(closed),
        new ButtonBuilder()
            .setCustomId(closed ? "ticket_reopen" : "ticket_close")
            .setLabel(closed ? "Reopen" : "Close")
            .setStyle(closed ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_transcript")
            .setLabel("Transcript")
            .setStyle(ButtonStyle.Secondary),
    );
function staff(member, c) {
    return (
        member.permissions.has(PermissionFlagsBits.ManageChannels) ||
        (c.supportRoleIds || []).some((id) => member.roles.cache.has(id))
    );
}
async function save(id, data) {
    db.getDB().tickets[id] = data;
    await db.save();
}
async function create(interaction) {
    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (locks.has(key))
        return interaction.reply({ content: "Ticket creation is already in progress.", ephemeral: true });
    locks.set(key, true);
    try {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild,
            c = config(guild.id);
        const existing = Object.values(db.getDB().tickets).find(
            (ticket) =>
                ticket.guildId === guild.id &&
                ticket.ownerId === interaction.user.id &&
                ticket.status === "open",
        );
        if (existing && (await guild.channels.fetch(existing.channelId).catch(() => null)))
            return interaction.editReply({
                content: `You already have an open ticket: <#${existing.channelId}>.`,
            });
        const overwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            {
                id: guild.members.me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                ],
            },
        ];
        for (const id of c.supportRoleIds || [])
            if (id !== guild.id && guild.roles.cache.has(id))
                overwrites.push({
                    id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                });
        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.id.slice(-6)}`,
            type: ChannelType.GuildText,
            parent: c.categoryId || null,
            topic: `Zeechei ticket · owner ${interaction.user.id}`,
            permissionOverwrites: overwrites,
        });
        const ticket = {
            guildId: guild.id,
            channelId: channel.id,
            ownerId: interaction.user.id,
            status: "open",
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            claimedBy: null,
        };
        try {
            await save(channel.id, ticket);
        } catch (error) {
            await channel.delete("Ticket persistence failed").catch(() => {});
            throw error;
        }
        await channel.send({
            content: `<@${interaction.user.id}> · Your support space is ready. Share what you need help with.`,
            components: [controls(false)],
            allowedMentions: { users: [interaction.user.id], parse: [] },
        });
        return interaction.editReply({ content: `Your ticket is ready: <#${channel.id}>.` });
    } finally {
        locks.delete(key);
    }
}
async function transition(guild, ticket, closed, actorId) {
    const channel = await guild.channels.fetch(ticket.channelId);
    if (!channel) throw new Error("Ticket channel missing");
    await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: closed ? false : true });
    ticket = {
        ...ticket,
        status: closed ? "closed" : "open",
        closedAt: closed ? Date.now() : null,
        closedBy: closed ? actorId : null,
        lastActivityAt: Date.now(),
    };
    await save(ticket.channelId, ticket);
    await channel.send({
        content: closed ? "Ticket closed. Staff can reopen it below." : "Ticket reopened.",
        components: [controls(closed)],
    });
}
async function handle(interaction) {
    if (interaction.customId === "ticket_create") return create(interaction);
    const ticket = db.getDB().tickets[interaction.channelId];
    if (!ticket || ticket.guildId !== interaction.guildId) return false;
    const c = config(interaction.guildId),
        isStaff = staff(interaction.member, c);
    if (ticket.ownerId !== interaction.user.id && !isStaff)
        return interaction.reply({
            content: "Only this ticket’s owner and support staff can use its controls.",
            ephemeral: true,
        });
    if (["ticket_claim", "ticket_reopen"].includes(interaction.customId) && !isStaff)
        return interaction.reply({ content: "Support staff access is required.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const key = `channel:${ticket.channelId}`;
    if (locks.has(key)) return interaction.editReply({ content: "Another ticket action is in progress." });
    locks.set(key, true);
    try {
        if (interaction.customId === "ticket_claim") {
            if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id)
                return interaction.editReply({ content: `Already claimed by <@${ticket.claimedBy}>.` });
            await save(ticket.channelId, { ...ticket, claimedBy: interaction.user.id });
            return interaction.editReply({ content: "Ticket assigned to you." });
        }
        if (["ticket_close", "ticket_reopen"].includes(interaction.customId)) {
            const closed = interaction.customId === "ticket_close";
            if ((ticket.status === "closed") === closed)
                return interaction.editReply({ content: `Ticket is already ${closed ? "closed" : "open"}.` });
            await transition(interaction.guild, ticket, closed, interaction.user.id);
            return interaction.editReply({ content: closed ? "Ticket closed." : "Ticket reopened." });
        }
        if (interaction.customId === "ticket_transcript") {
            const lines = [];
            let before;
            while (lines.length < 5000) {
                const messages = await interaction.channel.messages.fetch({
                    limit: 100,
                    ...(before ? { before } : {}),
                });
                if (!messages.size) break;
                for (const message of messages.values())
                    lines.push(
                        `[${message.createdAt.toISOString()}] ${message.author.tag}: ${message.content}\n${[...message.attachments.values()].map((file) => file.url).join("\n")}`,
                    );
                before = messages.last().id;
                if (messages.size < 100) break;
            }
            const file = new AttachmentBuilder(
                Buffer.from(
                    `Zeechei transcript · latest ${lines.length} messages (limit 5000)\n\n${lines.reverse().join("\n")}`,
                ),
                { name: `ticket-${ticket.channelId}.txt` },
            );
            await interaction.editReply({ content: "Transcript ready.", files: [file] });
            if (c.transcriptChannelId) {
                const logs = await interaction.guild.channels.fetch(c.transcriptChannelId).catch(() => null);
                await logs
                    ?.send({ content: `Ticket <#${ticket.channelId}> · transcript`, files: [file] })
                    .catch(() => {});
            }
            return;
        }
    } finally {
        locks.delete(key);
    }
}
async function sweep(client) {
    for (const ticket of Object.values(db.getDB().tickets)) {
        if (!ticket.guildId || !ticket.channelId) continue;
        const c = config(ticket.guildId);
        if (
            ticket.status !== "open" ||
            !c.autoCloseHours ||
            Date.now() - (ticket.lastActivityAt || ticket.createdAt) < c.autoCloseHours * 3600000
        )
            continue;
        const guild = client.guilds.cache.get(ticket.guildId);
        if (!guild || locks.has(`channel:${ticket.channelId}`)) continue;
        locks.set(`channel:${ticket.channelId}`, true);
        try {
            await transition(guild, ticket, true, client.user.id);
        } catch (error) {
            logger.warn("Ticket auto-close failed", { guild: ticket.guildId, error: error.message });
        } finally {
            locks.delete(`channel:${ticket.channelId}`);
        }
    }
}
function activity(message) {
    const ticket = db.getDB().tickets[message.channelId];
    if (ticket?.status === "open" && Date.now() - (ticket.lastActivityAt || 0) > 60000) {
        ticket.lastActivityAt = Date.now();
        void db.save();
    }
}
async function publish(guild, channelId) {
    const key = `panel:${guild.id}`;
    if (locks.has(key)) throw new Error("Panel update in progress");
    locks.set(key, true);
    try {
        const channel = await guild.channels.fetch(channelId);
        if (
            !channel?.isTextBased() ||
            !channel.permissionsFor(guild.members.me)?.has(["ViewChannel", "SendMessages"])
        )
            throw new Error("Bot needs access to the target text channel");
        const previous = db.getGuild(guild.id).ticketPanel;
        const payload = {
            content: "**Your support space**\nNeed a hand? Open a private ticket with our team.",
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("ticket_create")
                        .setLabel("Open a ticket")
                        .setStyle(ButtonStyle.Primary),
                ),
            ],
            allowedMentions: { parse: [] },
        };
        let message;
        if (previous?.channelId === channelId)
            message = await channel.messages.fetch(previous.messageId).catch((error) => {
                if (error.code !== 10008) throw error;
                return null;
            });
        if (message && message.author.id !== guild.client.user.id)
            throw new Error("Invalid ticket panel author");
        message = message ? await message.edit(payload) : await channel.send(payload);
        db.updateGuild(guild.id, { ticketPanel: { channelId, messageId: message.id } });
        await db.flush();
        return { channelId, messageId: message.id };
    } finally {
        locks.delete(key);
    }
}
module.exports = { create, handle, sweep, activity, config, staff, publish, transition };
