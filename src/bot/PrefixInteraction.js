/** Minimal transport adapter: shared slash commands retain the same service logic. */
function prefixInteraction(message, args) {
    let response;
    const payload = (value) => {
        const { ephemeral, flags, ...rest } = typeof value === "string" ? { content: value } : value;
        return { ...rest, allowedMentions: { parse: [] } };
    };
    const interaction = {
        id: message.id,
        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guild.id,
        channel: message.channel,
        channelId: message.channelId,
        client: message.client,
        options: { getString: () => args.join(" "), getInteger: () => Number(args[0]) },
        deferred: false,
        replied: false,
        reply: async (value) => {
            response = await message.reply(payload(value));
            interaction.replied = true;
            return response;
        },
        deferReply: async () => {
            response = await message.reply({
                content: "Finding your track…",
                allowedMentions: { parse: [] },
            });
            interaction.deferred = true;
        },
        editReply: async (value) => response.edit(payload(value)),
        followUp: async (value) => message.reply(payload(value)),
    };
    return interaction;
}
module.exports = { prefixInteraction };
