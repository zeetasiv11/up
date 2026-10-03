const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { LavalinkPlayer } = require("../src/music/LavalinkPlayer");

test("voice REST failure rejects initial creation but later updates are handled by the music owner", async () => {
    const manager = Object.assign(new EventEmitter(), { players: new Map() });
    const failed = Object.assign(new Error("synthetic rejected voice update"), { status: 403 });
    const node = {
        name: "primary",
        manager,
        rest: {
            updatePlayer: async () => {
                throw failed;
            },
        },
    };
    const player = new LavalinkPlayer("guild", node);
    const connection = {
        sessionId: "synthetic-session",
        channelId: "voice",
        serverUpdate: { token: "synthetic-token", endpoint: "synthetic.invalid" },
    };
    await assert.rejects(player.sendServerUpdate(connection), failed);
    manager.players.set("guild", player);
    let errors = 0,
        recoveries = 0;
    manager.on("error", (name, error) => {
        assert.equal(name, "primary");
        assert.equal(error.status, 403);
        errors++;
    });
    manager.on("voiceUpdateFailed", (id) => {
        assert.equal(id, "guild");
        recoveries++;
    });
    await player.sendServerUpdate(connection);
    assert.equal(errors, 1);
    assert.equal(recoveries, 1);
});
