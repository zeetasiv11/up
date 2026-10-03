const settings = require("../../settings.js");
const db = require("../../utils/database.js");
const quests = require("../quest/questService.js");
const DAY = 86400000;

function claim(userId, kind, now = Date.now(), random = Math.random) {
    const user = db.getUser(userId);
    const rules = {
        daily: ["lastDaily", settings.economy.dailyCooldownHours * 3600000],
        weekly: ["lastWeekly", 7 * DAY],
        work: ["lastWork", settings.economy.workCooldownHours * 3600000],
    };
    if (!Object.hasOwn(rules, kind)) throw new Error("Unknown reward");
    const [field, cooldown] = rules[kind];
    if (user[field] && now - user[field] < cooldown)
        return { ok: false, remaining: cooldown - (now - user[field]) };
    let amount;
    const update = { [field]: now };
    if (kind === "daily") {
        update.dailyStreak =
            user.lastDaily && now - user.lastDaily <= 2 * DAY ? (user.dailyStreak || 0) + 1 : 1;
        const streak = update.dailyStreak;
        const bonus = streak <= 3 ? (streak - 1) * 200 : 400 + (streak - 3) * 300;
        amount = settings.economy.dailyAmount + bonus;
    } else if (kind === "weekly") amount = settings.economy.weeklyAmount ?? 5000;
    else
        amount =
            settings.economy.workMin +
            Math.floor(random() * (settings.economy.workMax - settings.economy.workMin + 1));
    const balance = user.balance + amount;
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(balance))
        throw new RangeError("Invalid reward amount");
    db.updateUser(userId, { ...update, balance });
    quests.progressQuest(userId, "earn_coins", amount);
    return { ok: true, amount, balance, streak: update.dailyStreak };
}
module.exports = { claim };
