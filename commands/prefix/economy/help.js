const settings = require("../../../settings.js");
const { createInfoEmbed } = require("../../../utils/embeds.js");

module.exports = {
    name: "help",
    aliases: ["commands"],
    category: "info",
    description: "Lihat daftar Z command",
    usage: "zhelp",
    async execute(message) {
        const p = settings.textCommandPrefix || "z";
        const description =
            `💰 **ECONOMY**\n` +
            `${p}cash/${p}bal, ${p}bank, ${p}deposit, ${p}withdraw, ${p}pay, ${p}daily, ${p}weekly, ${p}work, ${p}streak\n\n` +
            `🎮 **GAMES**\n` +
            `${p}ubj (Blackjack), ${p}slots, ${p}coinflip, ${p}dice, ${p}mines, ${p}roulette, ${p}highlow, ${p}guess, ${p}lottery\n\n` +
            `🐾 **ANIMALS**\n` +
            `${p}hunt, ${p}animals/${p}zoo\n\n` +
            `🐶 **PETS**\n` +
            `${p}pets, ${p}pet adopt/equip/feed/rename/stats\n\n` +
            `⚔️ **BATTLE**\n` +
            `${p}battle npc, ${p}battle @user, ${p}boss, ${p}boss attack\n\n` +
            `🎒 **ITEMS**\n` +
            `${p}inventory/${p}inv, ${p}shop, ${p}buy, ${p}sell, ${p}crate open <id>\n\n` +
            `📜 **QUEST**\n` +
            `${p}quest, ${p}quest claim <no>, ${p}quest reroll\n\n` +
            `🏆 **PROFILE**\n` +
            `${p}profile, ${p}level, ${p}leaderboard [coins|level|animals|wins|battle], ${p}achievements\n\n` +
            `❤️ **SOCIAL**\n` +
            `${p}hug, ${p}pat, ${p}slap, ${p}cuddle, ${p}highfive, ${p}cookie, ${p}kiss, ${p}compliment, ${p}insult, ${p}ship\n\n` +
            `💍 **MARRIAGE**\n` +
            `${p}marry @user, ${p}divorce, ${p}couple\n\n` +
            `🎲 **FUN**\n` +
            `${p}8ball <pertanyaan>, ${p}choose a | b | c, ${p}roll [min-max]\n\n` +
            `🛠️ **ADMIN**\n` +
            `${p}economy set/add/remove/reset @user [amount], ${p}game enable/disable <game>\n\n` +
            `🎵 **MUSIC** — gunakan command music existing\n` +
            `🤖 **AI** — gunakan command AI existing\n` +
            `🎤 **AI VOICE** — gunakan command AI Voice existing\n` +
            `🛡️ **MODERATION** — gunakan command moderation existing\n\n` +
            `Semua command TANPA "/", contoh: \`${p}cash\`, \`${p}ubj 1000\`, \`${p}hunt\`, \`${p}battle npc\`.`;

        await message.reply({ embeds: [createInfoEmbed(description, "🤖 ZEETASI Z-COMMANDS")] });
    }
};
