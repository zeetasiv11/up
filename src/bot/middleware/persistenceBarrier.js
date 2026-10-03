const db = require("../../../utils/database");
const wrapped = Symbol("persistenceBarrier");
// Discord acknowledgements (deferReply/deferUpdate/showModal) remain immediate.
// Success messages only leave the process after prior state changes are durable.
function persistenceBarrier(target, methods = ["reply", "editReply", "followUp", "update"]) {
    if (target[wrapped]) return;
    target[wrapped] = true;
    for (const name of methods) {
        if (typeof target[name] !== "function") continue;
        const original = target[name].bind(target);
        target[name] = async (...args) => {
            try {
                await db.flush();
            } catch {
                if (name === "reply" || name === "editReply" || name === "followUp")
                    return original({
                        content:
                            "Penyimpanan sedang tidak tersedia. Perubahan belum dapat dikonfirmasi; hubungi pengelola bot.",
                        ...(name === "reply" || name === "followUp" ? { ephemeral: true } : {}),
                    });
                throw new Error("Database persistence failed");
            }
            if (target.moderationCaseNumber && args[0]?.embeds) {
                for (const embed of args[0].embeds)
                    embed.setFooter?.({ text: `Zeechei · Case #${target.moderationCaseNumber}` });
            }
            return original(...args);
        };
    }
}
module.exports = { persistenceBarrier };
