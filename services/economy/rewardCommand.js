const rewards = require("./rewardService.js");
const db = require("../../utils/database.js");
const { createSuccessEmbed, createWarningEmbed } = require("../../utils/embeds.js");
async function execute(context, kind) {
    const result = rewards.claim((context.user || context.author).id, kind);
    if (!result.ok)
        return context.reply({
            embeds: [createWarningEmbed(`Coba lagi dalam ${Math.ceil(result.remaining / 60000)} menit.`)],
            ...(context.user ? { ephemeral: true } : {}),
        });
    await db.flush();
    return context.reply({
        embeds: [
            createSuccessEmbed(
                `+${result.amount.toLocaleString("id-ID")} coin\nSaldo: ${result.balance.toLocaleString("id-ID")}` +
                    (result.streak ? `\nDaily streak: ${result.streak}` : ""),
                `${kind[0].toUpperCase()}${kind.slice(1)} reward`,
            ),
        ],
    });
}
module.exports = { execute };
