const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require("discord.js");
const { checkVoiceChannel } = require("../../utils/musicChecks.js");
const { createErrorEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const logger = require("../../utils/logger.js");
module.exports = {
    data: new SlashCommandBuilder().setName("play").setDescription("Cari dan putar musik bersama melalui Lavalink")
        .addStringOption(option => option.setName("query").setDescription("Judul, artis, atau URL musik").setRequired(true).setMaxLength(2000)),
    category: "music",
    async execute(interaction) {
        const check = checkVoiceChannel(interaction);
        if (!check.ok) return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true });
        if (!interaction.client.music) return interaction.reply({ content: "Fitur music belum tersedia.", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        try {
            const result = await interaction.client.music.resolve(interaction.options.getString("query", true));
            let tracks = result.tracks;
            if (result.type === "search") {
                const candidates = tracks.slice(0, 5);
                if (!candidates.length) throw new Error("Empty search");
                const menu = new StringSelectMenuBuilder().setCustomId(`music_search:${interaction.id}`).setPlaceholder("Choose your track")
                    .addOptions(candidates.map((track, i) => ({ label: track.info.title.slice(0, 100) || "Untitled", value: String(i), description: track.info.author.slice(0, 100) || "Unknown artist" })));
                const message = await interaction.editReply({ content: "Pilih lagu untuk ditambahkan ke antrian.", components: [new ActionRowBuilder().addComponents(menu)] });
                let selected;
                try { selected = await message.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 45000,
                    filter: pick => pick.user.id === interaction.user.id && pick.customId === menu.data.custom_id }); }
                catch { return interaction.editReply({ content: "Pencarian kedaluwarsa. Gunakan /play lagi.", components: [] }); }
                await selected.deferUpdate();
                tracks = [candidates[Number(selected.values[0])]];
                if (!tracks[0]) throw new Error("Invalid selection");
            }
            const denied = require("../../src/bot/middleware/accessPolicy").accessError(interaction.user.id, interaction.guildId);
            if (denied) return interaction.editReply({ content:denied, components:[] });
            const count = await interaction.client.music.enqueue(check.memberVoice, tracks, { textChannel: interaction.channel, member: interaction.member });
            return interaction.editReply({ content: "", embeds: [createSuccessEmbed(count === 1 ? tracks[0].info.title.slice(0, 250) : `${count} tracks added`, "Added to queue")], components: [] });
        } catch (error) {
            logger.error(`Music request failed: ${error.message}`);
            return interaction.editReply({ content: "", embeds: [createErrorEmbed("Lagu belum bisa diputar. Pastikan kamu masih di voice channel yang sama dan node/source tersedia.")], components: [] });
        }
    }
};
