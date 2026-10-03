const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createAuth, HttpError } = require("./auth");
const { createSettingsService } = require("./settings");
const { playerState, control, musicMember, createMusicSearch } = require("./music");
const { health } = require("../../utils/keepAlive");
const logger = require("../../utils/logger");
const assets = new Map([
    ["/", ["index.html", "text/html"]],
    ["/app.js", ["app.js", "text/javascript"]],
    ["/styles.css", ["styles.css", "text/css"]],
]);
async function body(req) {
    if (req.headers["content-type"]?.split(";")[0] !== "application/json")
        throw new HttpError(415, "Expected application/json.");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 32768) throw new HttpError(413, "Request too large.");
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
        throw new HttpError(400, "Invalid JSON.");
    }
}
function createDashboard({
    client = null,
    db = require("../../utils/database"),
    defaults = require("../../settings"),
    env = process.env,
    auth = createAuth({ env }),
} = {}) {
    const config = createSettingsService(db, defaults);
    const musicSearch = createMusicSearch();
    const library = require("./musicLibrary").createMusicLibrary(db);
    const limits = new Map();
    const streams = new Map();
    const json = (res, data, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data));
    };
    const server = http.createServer(async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        );
        try {
            const now = Date.now();
            for (const [key, value] of limits) if (value.until < now) limits.delete(key);
            const ip = req.socket.remoteAddress;
            const bucket = limits.get(ip) || { count: 0, until: now + 60000 };
            bucket.count++;
            limits.set(ip, bucket);
            if (limits.size > 10000 || bucket.count > 180)
                throw new HttpError(429, "Too many requests. Try again in a minute.");
            const url = new URL(req.url, "http://localhost");
            const route = url.pathname;
            if (req.method === "GET" && assets.has(route)) {
                const [file, type] = assets.get(route);
                const data = await fs.readFile(path.join(__dirname, "../frontend", file));
                res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
                return res.end(data);
            }
            if (req.method === "GET" && ["/health", "/api/health", "/ready"].includes(route)) {
                const status = health(client ? [client] : []);
                return json(res, status, route === "/ready" && status.status !== "ok" ? 503 : 200);
            }
            if (req.method === "GET" && route === "/api/config")
                return json(res, {
                    oauthConfigured: auth.configured,
                    botOnline: Boolean(client?.isReady()),
                    storage: db.status?.().backend || "legacy",
                    version: "V4+++ preview",
                });
            if (req.method === "GET" && route === "/api/auth/login") return auth.login(res);
            if (req.method === "GET" && route === "/api/auth/callback")
                return await auth.callback(req, res, url);
            const session = auth.session(req);
            if (!["GET", "HEAD"].includes(req.method)) auth.csrf(req, session);
            return await require("../../src/utils/requestContext").run(
                { actor: session.user.id },
                async () => {
                    if (req.method === "POST" && route === "/api/auth/logout") {
                        auth.logout(req, res);
                        return json(res, { ok: true });
                    }
                    if (req.method === "GET" && route === "/api/user")
                        return json(res, {
                            user: session.user,
                            csrf: session.csrf,
                            owner: defaults.ownerIds.includes(session.user.id),
                        });
                    if (req.method === "GET" && route === "/api/guilds") {
                        const guilds = await auth.guilds(session);
                        return json(
                            res,
                            guilds.map((guild) => ({
                                id: guild.id,
                                name: guild.name,
                                icon: guild.icon
                                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp`
                                    : "",
                                installed: Boolean(client?.guilds.cache.has(guild.id)),
                                invite: `https://discord.com/oauth2/authorize?client_id=${env.CLIENT_ID}&scope=bot%20applications.commands&permissions=0&guild_id=${guild.id}&disable_guild_select=true`,
                            })),
                        );
                    }
                    if (route === "/api/owner/emojis") {
                        if (!defaults.ownerIds.includes(session.user.id))
                            throw new HttpError(403, "Owner access required.");
                        const keys = Object.keys(require("../../src/music/MusicEmojiManager").FALLBACKS);
                        if (req.method === "GET")
                            return json(res, { keys, values: db.getDB().stats.musicEmojis || {} });
                        if (req.method === "PATCH") {
                            const { z } = require("zod");
                            const input = z
                                .object(
                                    Object.fromEntries(
                                        keys.map((key) => [
                                            key,
                                            z
                                                .string()
                                                .regex(/^(?:<a?:[a-zA-Z0-9_]+:\d{17,20}>)?$/)
                                                .optional(),
                                        ]),
                                    ),
                                )
                                .strict()
                                .parse(await body(req));
                            db.getDB().stats.musicEmojis = input;
                            await db.save();
                            if (client?.music)
                                for (const queue of client.music.queues.values())
                                    await client.music.notify(queue);
                            return json(res, { keys, values: input });
                        }
                        throw new HttpError(405, "Method not allowed.");
                    }
                    if (req.method === "GET" && route === "/api/owner") {
                        if (!defaults.ownerIds.includes(session.user.id))
                            throw new HttpError(403, "Owner access required.");
                        return json(res, {
                            ...health(client ? [client] : []),
                            memory: process.memoryUsage().rss,
                            guildCount: client?.guilds.cache.size || 0,
                            userCount: client?.users.cache.size || 0,
                            commands: client?.commands.size || 0,
                            node: process.version,
                        });
                    }
                    const match = route.match(
                        /^\/api\/guilds\/(\d{17,20})(?:\/(settings|music|music-search|music-enqueue|stream|cases|tickets|history|favorites|playlists|audit|overview))?$/,
                    );
                    if (!match) throw new HttpError(404, "Not found.");
                    const [, guildId, section = "overview"] = match;
                    await auth.authorize(session, guildId);
                    const guild = client?.guilds.cache.get(guildId);
                    if (!guild)
                        throw new HttpError(409, "The bot must be online and installed in this server.");
                    if (req.method === "GET" && section === "stream") {
                        const count = streams.get(session.user.id) || 0;
                        if (count >= 3) throw new HttpError(429, "Too many live player connections.");
                        streams.set(session.user.id, count + 1);
                        res.writeHead(200, {
                            "Content-Type": "text/event-stream",
                            Connection: "keep-alive",
                            "X-Accel-Buffering": "no",
                        });
                        let signature = "",
                            closed = false,
                            checking = false;
                        const send = (id) => {
                            if ((id && id !== guildId) || closed) return;
                            try {
                                auth.session(req);
                                const value = JSON.stringify(playerState(client, guildId));
                                if (value !== signature) {
                                    if (!res.write(`data: ${value}\n\n`)) return res.end();
                                    signature = value;
                                }
                            } catch {
                                res.end();
                            }
                        };
                        client.music?.on("change", send);
                        send();
                        const timer = setInterval(async () => {
                            if (checking || closed) return;
                            checking = true;
                            try {
                                auth.session(req);
                                await auth.authorize(session, guildId);
                                if (!closed) res.write(": keepalive\n\n");
                            } catch {
                                res.end();
                            } finally {
                                checking = false;
                            }
                        }, 30000);
                        timer.unref();
                        res.on("close", () => {
                            closed = true;
                            clearInterval(timer);
                            client.music?.off("change", send);
                            const remaining = (streams.get(session.user.id) || 1) - 1;
                            if (remaining) streams.set(session.user.id, remaining);
                            else streams.delete(session.user.id);
                        });
                        return;
                    }
                    if (req.method === "GET") {
                        if (section === "settings") return json(res, config.get(guildId));
                        if (section === "music") return json(res, playerState(client, guildId));
                        if (section === "tickets")
                            return json(
                                res,
                                Object.values(db.getDB().tickets).filter(
                                    (ticket) => ticket.guildId === guildId,
                                ),
                            );
                        if (section === "cases")
                            return json(res, (db.getGuild(guildId).moderationCases || []).slice(-200));
                        if (section === "history") return json(res, db.getGuild(guildId).musicHistory || []);
                        if (["favorites", "playlists"].includes(section))
                            return json(res, library.read(session.user.id, section));
                        if (section === "audit") return json(res, db.getGuild(guildId).configAudit || []);
                        const channels = await guild.channels.fetch();
                        const roles = await guild.roles.fetch();
                        return json(res, {
                            id: guild.id,
                            name: guild.name,
                            members: guild.memberCount,
                            categories: [...channels.values()]
                                .filter((channel) => channel?.type === 4)
                                .map((channel) => ({ id: channel.id, name: channel.name })),
                            channels: [...channels.values()]
                                .filter((channel) => channel?.isTextBased() && !channel.isThread?.())
                                .map((channel) => ({ id: channel.id, name: channel.name })),
                            roles: [...roles.values()]
                                .filter((role) => role.id !== guild.id)
                                .map((role) => ({ id: role.id, name: role.name })),
                            uptime: Math.floor(process.uptime()),
                        });
                    }
                    if (req.method === "POST" && section === "tickets") {
                        const member = await guild.members.fetch(session.user.id);
                        if (!member.permissions.has("ManageChannels"))
                            throw new HttpError(403, "Manage Channels is required.");
                        const input = require("zod")
                            .z.object({
                                channelId: require("zod")
                                    .z.string()
                                    .regex(/^\d{17,20}$/),
                            })
                            .strict()
                            .parse(await body(req));
                        return json(
                            res,
                            await require("../../src/services/tickets/ticketService").publish(
                                guild,
                                input.channelId,
                            ),
                        );
                    }
                    if (req.method === "PATCH" && section === "settings")
                        return json(res, await config.update(guild, session.user.id, await body(req)));
                    if (req.method === "POST" && ["favorites", "playlists"].includes(section)) {
                        const input = await body(req);
                        if (input?.action === "addCurrent") await musicMember(client, guild, session.user.id);
                        return json(
                            res,
                            await library.update(
                                session.user.id,
                                section,
                                input,
                                client.music?.getQueue(guildId)?.songs[0],
                            ),
                        );
                    }
                    if (req.method === "POST" && section === "music-search")
                        return json(
                            res,
                            await musicSearch.search(client, guild, session.user.id, await body(req)),
                        );
                    if (req.method === "POST" && section === "music-enqueue")
                        return json(
                            res,
                            await musicSearch.enqueue(client, guild, session.user.id, await body(req)),
                        );
                    if (req.method === "POST" && section === "music")
                        return json(res, await control(client, guild, session.user.id, await body(req)));
                    throw new HttpError(405, "Method not allowed.");
                },
            );
        } catch (error) {
            const status = error.status || (error.name === "ZodError" ? 400 : 500);
            if (status >= 500)
                logger.error("Dashboard request failed", {
                    service: "web", error: error.message,
                    upstreamStatus: error.upstreamStatus,
                    upstreamRoute: error.upstreamRoute,
                    retryAfter: error.retryAfter,
                });
            if (!res.headersSent && error.retryAfter)
                res.setHeader("Retry-After", String(error.retryAfter));
            if (!res.headersSent)
                json(
                    res,
                    {
                        error:
                            status === 500
                                ? "Request failed. Please try again."
                                : error.name === "ZodError"
                                  ? "Invalid input. Check your values."
                                  : error.message,
                    },
                    status,
                );
            else res.end();
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.on("close", () => auth.close());
    return server;
}
function startDashboard(client) {
    const server = createDashboard({ client });
    const port = Number(process.env.PORT || process.env.WEB_PORT || 3000);
    server.listen(port, "0.0.0.0", () => logger.info(`Dashboard listening on ${port}`, { service: "web" }));
    return server;
}
module.exports = { createDashboard, startDashboard };
