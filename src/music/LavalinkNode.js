const { Node, Constants } = require("shoukaku");
const WebSocket = require("ws");

// Keep Shoukaku's node/session/player model. Its 4.3 connect loop retains the
// previous attempt's error after a successful retry and closes that new socket.
// LavalinkManager installs this node in the same Shoukaku client's addNode path.
class LavalinkNode extends Node {
    async connect() {
        const { State } = Constants;
        if (!this.manager.id) throw new Error("Discord connector is not ready.");
        if (this.manager.musicClosing || [State.CONNECTED, State.CONNECTING].includes(this.state)) return;
        this.cleanupWebsocket();
        this.state = State.CONNECTING;
        let lastError;
        for (this.reconnects = 0; this.reconnects < this.manager.options.reconnectTries; this.reconnects++) {
            if (this.manager.musicClosing) return;
            try {
                this.ws = await this.openSocket();
                if (this.manager.musicClosing) {
                    this.cleanupWebsocket();
                    this.state = State.DISCONNECTED;
                    return;
                }
                this.ws.once("close", (...args) => void this.close(...args));
                return;
            } catch (error) {
                if (this.manager.musicClosing) return;
                lastError = error;
                this.emit(
                    "reconnecting",
                    this.manager.options.reconnectTries - this.reconnects - 1,
                    this.manager.options.reconnectInterval,
                );
                await new Promise((resolve) => {
                    this.wakeRetry = resolve;
                    this.retryTimer = setTimeout(resolve, this.manager.options.reconnectInterval * 1000);
                });
                this.wakeRetry = null;
                this.retryTimer = null;
            }
        }
        this.state = State.DISCONNECTED;
        this.cleanupWebsocket();
        const moved = this.manager.options.moveOnDisconnect ? await this.movePlayers() : 0;
        this.emit("disconnect", moved);
        if (!this.manager.musicClosing) throw lastError || new Error("Node connection attempts exhausted.");
    }
    openSocket() {
        const headers = {
            Authorization: this.auth,
            "User-Id": this.manager.id,
            "Client-Name": "ZEEchei/Shoukaku-4.3",
            "User-Agent": this.manager.options.userAgent,
        };
        if (this.sessionId && this.manager.options.resume) headers["Session-Id"] = this.sessionId;
        const socket = new WebSocket(this.url, {
            headers,
            handshakeTimeout: this.manager.options.restTimeout * 1000,
        });
        this.pendingSocket = socket;
        socket.once("upgrade", (response) => this.open(response));
        socket.on("message", (data) => void this.message(data).catch((error) => this.error(error)));
        socket.on("error", (error) => this.error(error));
        return new Promise((resolve, reject) => {
            const failed = () => {
                socket.removeAllListeners();
                reject(new Error("Node websocket closed before the handshake completed."));
            };
            socket.once("close", failed);
            socket.once("open", () => {
                socket.off("close", failed);
                resolve(socket);
            });
        }).finally(() => {
            if (this.pendingSocket === socket) this.pendingSocket = null;
        });
    }
    async close(code, reason) {
        if (this.manager.musicClosing) {
            clearTimeout(this.retryTimer);
            this.wakeRetry?.();
            this.pendingSocket?.terminate();
            this.cleanupWebsocket();
            this.state = Constants.State.DISCONNECTED;
            return;
        }
        return super.close(code, reason);
    }
}
module.exports = { LavalinkNode };
