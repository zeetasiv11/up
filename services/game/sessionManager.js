const { randomUUID } = require("node:crypto");
const db = require("../../utils/database");
const sessions = new Map(),
    activeByUser = new Map();
const encode = (value) =>
    JSON.parse(
        JSON.stringify(value, (key, item) =>
            require("node:util").types.isSet(item) ? { __set: [...item] } : item,
        ),
    );
const decode = (value) =>
    JSON.parse(JSON.stringify(value), (key, item) =>
        item && Array.isArray(item.__set) ? new Set(item.__set) : item,
    );
function checkpoint(session) {
    if (!session || session.ended) return db.flush();
    const user = db.getUser(session.ownerId);
    const activeGames = {
        ...(user.activeGames || {}),
        [session.id]: {
            id: session.id,
            type: session.type,
            ownerId: session.ownerId,
            data: encode(session.data),
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            playerName: session.playerName || "",
            channelId: session.message?.channelId || session.channelId || null,
            messageId: session.message?.id || session.messageId || null,
        },
    };
    db.updateUser(session.ownerId, { activeGames });
    return db.flush();
}
function installTimer(session, onTimeout) {
    const expire = async () => {
        if (session.ended) return;
        if (session.busy) {
            session.timeoutHandle = setTimeout(expire, 100);
            return;
        }
        session.busy = true;
        session.expiring = true;
        try {
            if (typeof onTimeout === "function") await onTimeout(session);
        } catch (error) {
            require("../../utils/logger").error(`Game timeout failed: ${error.message}`);
        } finally {
            endSession(session.id);
            await db.flush().catch(() => {});
        }
    };
    session.timeoutHandle = setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    session.timeoutHandle.unref?.();
}
function createSession(type, ownerId, data, timeoutMs, onTimeout) {
    const key = `${type}:${ownerId}`;
    if (activeByUser.has(key)) return null;
    const user = db.getUser(ownerId),
        bet = Number(data.bet || 0);
    if (!Number.isSafeInteger(bet) || bet < 0 || user.balance < bet) return null;
    const session = {
        id: `${type}_${ownerId}_${randomUUID()}`,
        type,
        ownerId,
        data,
        ended: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + timeoutMs,
    };
    sessions.set(session.id, session);
    activeByUser.set(key, session.id);
    // Escrow and the resumable game are committed in the same user snapshot.
    const activeGames = {
        ...(user.activeGames || {}),
        [session.id]: {
            id: session.id,
            type,
            ownerId,
            data: encode(data),
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
        },
    };
    db.updateUser(ownerId, { balance: user.balance - bet, activeGames });
    installTimer(session, onTimeout);
    return session;
}
function getSession(id) {
    const session = sessions.get(id);
    return !session || session.ended || session.expiring ? null : session;
}
function endSession(id) {
    const session = sessions.get(id);
    if (!session || session.ended) return false;
    session.ended = true;
    clearTimeout(session.timeoutHandle);
    sessions.delete(id);
    activeByUser.delete(`${session.type}:${session.ownerId}`);
    const user = db.getUser(session.ownerId);
    if (user.activeGames) delete user.activeGames[id];
    // Settlement adds its balance delta synchronously before this snapshot is queued.
    Promise.resolve()
        .then(() => db.save())
        .catch((error) =>
            require("../../utils/logger").error(`Game settlement persistence failed: ${error.message}`),
        );
    return true;
}
async function withAction(id, ownerId, action) {
    const session = getSession(id);
    if (!session || session.ownerId !== ownerId || session.busy) return false;
    session.busy = true;
    try {
        await action();
    } finally {
        session.busy = false;
        await checkpoint(session);
    }
    return true;
}
async function restore(client) {
    const handlers = {
        mines: () => require("./controllers/minesController").onTimeout,
        blackjack: () => require("./controllers/blackjackController").onTimeout,
        highlow: () => require("./controllers/highlowController").onTimeout,
        hunt: () => async (session) => {
            endSession(session.id);
        },
    };
    for (const [ownerId, user] of Object.entries(db.getDB().users))
        for (const saved of Object.values(user.activeGames || {})) {
            if (!handlers[saved.type] || sessions.has(saved.id)) continue;
            const session = { ...saved, ownerId, data: decode(saved.data), ended: false };
            if (saved.channelId && saved.messageId) {
                const channel = await client.channels.fetch(saved.channelId).catch(() => null);
                session.message = await channel?.messages?.fetch(saved.messageId).catch(() => null);
            }
            sessions.set(session.id, session);
            activeByUser.set(`${session.type}:${ownerId}`, session.id);
            installTimer(session, handlers[session.type]());
        }
}
function bindMessage(session, message) {
    session.message = message;
    return checkpoint(session);
}
module.exports = { createSession, getSession, endSession, withAction, checkpoint, restore, bindMessage };
