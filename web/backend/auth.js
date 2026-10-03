const crypto = require("node:crypto");
const API = "https://discord.com/api/v10";
const random = () => crypto.randomBytes(32).toString("base64url");
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function createAuth({ env = process.env, request = fetch, now = Date.now } = {}) {
    const sessions = new Map();
    const states = new Map();
    const origin = env.WEB_URL ? new URL(env.WEB_URL).origin : null;
    const secure = origin?.startsWith("https:");
    const configured = Boolean(
        origin && env.CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.SESSION_SECRET?.length >= 32,
    );
    if (env.NODE_ENV === "production" && configured && !secure)
        throw new Error("Production WEB_URL must use HTTPS");
    const callback = origin ? `${origin}/api/auth/callback` : "";
    if (env.DISCORD_REDIRECT_URI && env.DISCORD_REDIRECT_URI !== callback)
        throw new Error("DISCORD_REDIRECT_URI must match WEB_URL/api/auth/callback");
    const sign = (value) =>
        crypto
            .createHmac("sha256", env.SESSION_SECRET || "")
            .update(value)
            .digest("base64url");
    const cookie = (name, value, age) =>
        `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? "; Secure" : ""}`;
    function read(req, name) {
        const value = (req.headers.cookie || "")
            .split(";")
            .map((s) => s.trim())
            .find((s) => s.startsWith(`${name}=`))
            ?.slice(name.length + 1);
        if (!value) return null;
        const [id, mac] = value.split(".");
        const expected = sign(id);
        if (
            !mac ||
            mac.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
        )
            return null;
        return id;
    }
    function prune(map) {
        for (const [key, value] of map) if (value.expires <= now()) map.delete(key);
    }
    async function discord(path, token) {
        const response = await request(`${API}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) throw new HttpError(401, "Session expired. Sign in again.");
        if (!response.ok) {
            const error = new HttpError(503, "Discord is temporarily unavailable.");
            error.upstreamStatus = response.status;
            error.upstreamRoute = path;
            error.retryAfter = response.headers?.get("retry-after") || null;
            throw error;
        }
        return response.json();
    }
    return {
        configured,
        origin,
        login(res) {
            if (!configured) throw new HttpError(503, "Discord OAuth is not configured.");
            prune(states);
            if (states.size >= 1000) throw new HttpError(429, "Please try again shortly.");
            const state = random();
            states.set(state, { expires: now() + 300000 });
            const url = new URL("https://discord.com/oauth2/authorize");
            url.search = new URLSearchParams({
                client_id: env.CLIENT_ID,
                redirect_uri: callback,
                response_type: "code",
                scope: "identify guilds",
                state,
            }).toString();
            res.writeHead(302, {
                Location: url.href,
                "Set-Cookie": cookie("zeechei_oauth", `${state}.${sign(state)}`, 300),
            });
            res.end();
        },
        async callback(req, res, url) {
            if (!configured) throw new HttpError(503, "Discord OAuth is not configured.");
            const state = url.searchParams.get("state");
            const saved = states.get(state);
            const bound = read(req, "zeechei_oauth");
            if (!saved || saved.expires <= now() || state !== bound)
                throw new HttpError(400, "Invalid OAuth state. Start sign-in again.");
            states.delete(state);
            const code = url.searchParams.get("code");
            if (!code || code.length > 2048) throw new HttpError(400, "Authorization was not completed.");
            const response = await request(`${API}/oauth2/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: env.CLIENT_ID,
                    client_secret: env.DISCORD_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: callback,
                }),
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new HttpError(401, "Discord sign-in failed.");
            const token = await response.json();
            if (!token.access_token || !String(token.scope).split(" ").includes("guilds"))
                throw new HttpError(401, "Required Discord permission was not granted.");
            const user = await discord("/users/@me", token.access_token);
            prune(sessions);
            if (sessions.size >= 1000) throw new HttpError(503, "Dashboard session capacity reached.");
            const id = random();
            sessions.set(id, {
                user: { id: user.id, username: user.username, avatar: user.avatar },
                token: token.access_token,
                csrf: random(),
                expires: now() + Math.min(1800, token.expires_in || 1800) * 1000,
            });
            res.writeHead(302, {
                Location: "/",
                "Set-Cookie": [
                    cookie("zeechei_session", `${id}.${sign(id)}`, 1800),
                    cookie("zeechei_oauth", "", 0),
                ],
            });
            res.end();
        },
        session(req) {
            prune(sessions);
            const session = sessions.get(read(req, "zeechei_session"));
            if (!session) throw new HttpError(401, "Sign in with Discord.");
            return session;
        },
        csrf(req, session) {
            if (req.headers.origin !== origin || req.headers["x-csrf-token"] !== session.csrf)
                throw new HttpError(403, "Invalid request origin or CSRF token.");
        },
        async guilds(session) {
            return (await discord("/users/@me/guilds", session.token)).filter(
                (guild) => guild.owner || (BigInt(guild.permissions || "0") & 40n) !== 0n,
            );
        },
        async authorize(session, guildId) {
            // Re-fetch for each operation: revoked Manage Guild access takes effect immediately.
            const guild = (await this.guilds(session)).find((g) => g.id === guildId);
            if (!guild) throw new HttpError(403, "Manage Server permission is required.");
            return guild;
        },
        logout(req, res) {
            sessions.delete(read(req, "zeechei_session"));
            res.setHeader("Set-Cookie", cookie("zeechei_session", "", 0));
        },
        close() {
            sessions.clear();
            states.clear();
        },
    };
}
module.exports = { createAuth, HttpError };
