const settings = require("../../../settings.js");
const db = require("../../../utils/database.js");
const economy = require("../../../services/economy/economyService.js");
const questService = require("../../../services/quest/questService.js");
const petService = require("../../../services/pets/petService.js");
const battleEngine = require("../../../services/battle/battleEngine.js");
const cooldownManager = require("../../../services/game/cooldownManager.js");
const { createSuccessEmbed, createInfoEmbed, createErrorEmbed } = require("../../../utils/embeds.js");
const logger = require("../../../utils/logger.js");

const COOLDOWN_MS = 15 * 1000;

function recordBattle(userId, won) {
    const user = db.getUser(userId);
    const battle = user.battle || { wins: 0, losses: 0 };
    if (won) battle.wins += 1;
    else battle.losses += 1;
    db.updateUser(userId, { battle });
}

module.exports = {
    name: "battle",
    aliases: [],
    category: "battle",
    description: "Battle melawan NPC atau user lain menggunakan pet/animal terkuatmu",
    usage: "zbattle npc | zbattle @user",
    async execute(message, args) {
        const userId = message.author.id;
        const target = message.mentions.users.first();
        const wantsNpc = !target && (args[0] || "npc").toLowerCase() === "npc";

        const remaining = cooldownManager.checkCooldown("battle", userId, COOLDOWN_MS);
        if (remaining > 0) {
            return message.reply({ embeds: [createErrorEmbed(`⏳ Tunggu **${remaining}s** lagi sebelum battle lagi.`)] });
        }

        const myCombatant = petService.getBestCombatant(userId);
        if (!myCombatant) {
            return message.reply({ embeds: [createErrorEmbed("❌ Kamu belum punya animal/pet. Coba `zhunt` dulu untuk mendapatkan animal.")] });
        }

        if (target) {
            if (target.id === userId) {
                return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak bisa battle melawan dirimu sendiri.")] });
            }
            if (target.bot) {
                return message.reply({ embeds: [createErrorEmbed("❌ Kamu tidak bisa battle melawan bot.")] });
            }
            const theirCombatant = petService.getBestCombatant(target.id);
            if (!theirCombatant) {
                return message.reply({ embeds: [createErrorEmbed(`❌ ${target.username} belum punya animal/pet untuk battle.`)] });
            }

            const a = { name: myCombatant.stats.name, hp: myCombatant.stats.hp, atk: myCombatant.stats.atk, def: myCombatant.stats.def, spd: myCombatant.stats.spd };
            const b = { name: theirCombatant.stats.name, hp: theirCombatant.stats.hp, atk: theirCombatant.stats.atk, def: theirCombatant.stats.def, spd: theirCombatant.stats.spd };
            const result = battleEngine.simulate(a, b);

            const iWon = result.winner === "a";
            recordBattle(userId, iWon);
            recordBattle(target.id, !iWon && result.winner !== "draw");
            if (iWon) questService.progressQuest(userId, "battle", 1);
            logger.info(`[BATTLE] ${userId} vs ${target.id} winner=${result.winner}`);

            const headerText =
                `⚔️ **${message.author.username}'s ${a.name}**\n❤️ ${a.hp}  ⚔️ ${a.atk}  🛡️ ${a.def}\n\nVS\n\n` +
                `⚔️ **${target.username}'s ${b.name}**\n❤️ ${b.hp}  ⚔️ ${b.atk}  🛡️ ${b.def}\n\n`;
            const resultText = result.winner === "draw" ? "Hasilnya SERI!" : `Pemenang: **${result.winner === "a" ? message.author.username : target.username}**!`;
            const log = result.log.slice(-6).join("\n");

            return message.reply({ embeds: [createSuccessEmbed(`${headerText}${log}\n\n${resultText}`, "⚔️ BATTLE")] });
        }

        if (!wantsNpc) {
            return message.reply({ embeds: [createErrorEmbed("Gunakan format: `zbattle npc` atau `zbattle @user`")] });
        }

        const npc = battleEngine.rollNpc();
        const a = { name: myCombatant.stats.name, hp: myCombatant.stats.hp, atk: myCombatant.stats.atk, def: myCombatant.stats.def, spd: myCombatant.stats.spd };
        const b = { name: npc.name, hp: npc.hp, atk: npc.atk, def: npc.def, spd: npc.spd };
        const result = battleEngine.simulate(a, b);

        const iWon = result.winner === "a";
        recordBattle(userId, iWon);
        if (iWon) {
            economy.addBalance(userId, npc.reward);
            const user = db.getUser(userId);
            db.updateUser(userId, { xp: (user.xp || 0) + npc.xp });
            questService.progressQuest(userId, "battle", 1);
        }
        logger.info(`[BATTLE] ${userId} vs NPC(${npc.name}) winner=${result.winner}`);

        const headerText =
            `⚔️ **${message.author.username}'s ${a.name}**\n❤️ ${a.hp}  ⚔️ ${a.atk}  🛡️ ${a.def}\n\nVS\n\n` +
            `👹 **${npc.name}**\n❤️ ${npc.hp}  ⚔️ ${npc.atk}  🛡️ ${npc.def}\n\n`;
        const log = result.log.slice(-6).join("\n");
        const resultText = iWon
            ? `**KAMU MENANG!** +${npc.reward.toLocaleString("id-ID")} ${settings.economy.currencyIcon}, +${npc.xp} XP`
            : result.winner === "draw" ? "Hasilnya SERI!" : "**KAMU KALAH!**";

        await message.reply({ embeds: [iWon ? createSuccessEmbed(`${headerText}${log}\n\n${resultText}`, "⚔️ BATTLE") : createInfoEmbed(`${headerText}${log}\n\n${resultText}`, "⚔️ BATTLE")] });
    }
};
