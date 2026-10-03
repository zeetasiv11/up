const { Rest, RestError } = require("shoukaku");
const http = require("node:http");
const https = require("node:https");
class LavalinkRest extends Rest {
    async updateSession(resuming, timeout) {
        if (resuming && this.resumeUnavailable) return { resuming: false, timeout: 0 };
        try {
            return await super.updateSession(resuming, timeout);
        } catch (error) {
            // Some shared nodes allow playback but forbid session resumption.
            // Respect that policy and retain library-side player recovery.
            if (!resuming || error.status !== 403 || !this.node.manager.options.resumeByLibrary) throw error;
            this.resumeUnavailable = true;
            this.node.manager.emit("resumeUnavailable", this.node.name);
            return { resuming: false, timeout: 0 };
        }
    }
    async requestNative({ endpoint, options = {} }) {
        const url = new URL(`${this.url}${endpoint}`);
        if (options.params) url.search = new URLSearchParams(options.params).toString();
        const method = options.method?.toUpperCase() || "GET";
        const headers = { Authorization: this.auth, ...options.headers };
        if (this.node.manager.options.userAgent) headers["User-Agent"] = this.node.manager.options.userAgent;
        const body =
            !["GET", "HEAD"].includes(method) && options.body ? JSON.stringify(options.body) : undefined;
        if (body !== undefined) headers["Content-Length"] = Buffer.byteLength(body);
        // Keep Shoukaku's REST API and player registry. Native HTTP avoids the
        // fetch transport fingerprint rejected by this provider's Cloudflare edge.
        const signal = AbortSignal.timeout(this.node.manager.options.restTimeout * 1000);
        try {
            const response = await new Promise((resolve, reject) => {
                const transport = url.protocol === "https:" ? https : http;
                const req = transport.request(
                    url,
                    {
                        method,
                        headers,
                        signal,
                    },
                    resolve,
                );
                req.on("error", reject);
                req.end(body);
            });
            const chunks = [];
            for await (const chunk of response) chunks.push(chunk);
            let data;
            try {
                data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {}
            if (response.statusCode < 200 || response.statusCode >= 300) {
                throw new RestError({
                    ...(data && typeof data === "object" ? data : {}),
                    status: response.statusCode,
                    error: typeof data?.error === "string" ? data.error : "HTTP request failed",
                    message: typeof data?.message === "string" ? data.message : "Lavalink request rejected",
                });
            }
            return data;
        } catch (error) {
            if (signal.aborted) throw signal.reason;
            throw error;
        }
    }
    async fetch(request) {
        try {
            return await this.requestNative(request);
        } catch (cause) {
            const status = Number.isInteger(cause.status) ? cause.status : "network";
            const method = ["GET", "PATCH", "POST", "DELETE"].includes(request.options?.method?.toUpperCase())
                ? request.options.method.toUpperCase()
                : "GET";
            // Do not log session IDs, identifiers, voice tokens, headers or bodies.
            const operation = request.endpoint?.startsWith("/sessions/")
                ? request.endpoint.includes("/players")
                    ? "player"
                    : "session"
                : {
                      "/info": "info",
                      "/loadtracks": "search",
                      "/decodetrack": "decode",
                      "/decodetracks": "decode",
                  }[request.endpoint] || "request";
            const hint = [401, 403].includes(status)
                ? "Check node credentials/access policy."
                : status === 405
                  ? "The node/proxy rejected this HTTP method."
                  : status === 404
                    ? "Check Lavalink v4 routing and active session."
                    : "Check Lavalink node and proxy health.";
            const error = new Error(`Lavalink ${method} ${operation} failed (HTTP ${status}). ${hint}`, {
                cause,
            });
            // HTTP handlers need a numeric status even for network/timeouts.
            error.status = Number.isInteger(status) ? status : 503;
            error.operation = operation;
            error.method = method;
            error.code =
                cause.name === "AbortError" || cause.name === "TimeoutError"
                    ? "LAVALINK_TIMEOUT"
                    : "LAVALINK_REQUEST_FAILED";
            throw error;
        }
    }
}
module.exports = { LavalinkRest };
