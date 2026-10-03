const { Player } = require("shoukaku");

class LavalinkPlayer extends Player {
    async sendServerUpdate(connection) {
        try {
            return await super.sendServerUpdate(connection);
        } catch (error) {
            // Initial join is awaited and must reject so Shoukaku cleans it up.
            if (this.node.manager.players.get(this.guildId) !== this) throw error;
            // Later Discord voice updates are fire-and-forget inside Shoukaku.
            // Report them to the same lifecycle owner instead of rejecting unhandled.
            this.node.manager.emit("error", this.node.name, error);
            this.node.manager.emit("voiceUpdateFailed", this.guildId);
        }
    }
}
module.exports = { LavalinkPlayer };
