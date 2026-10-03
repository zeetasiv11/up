const test = require("node:test"),
    assert = require("node:assert/strict");
const { load, silent } = require("./helpers.cjs");
const { detect, defaults } = require("../src/services/automod/AutoMod");
const G = "111111111111111111",
    U = "222222222222222222";
test("AutoMod isolates guild rate windows, detects configured protections and ignores disabled rules", () => {
    const message = (guild, content = "hello") => ({
        guild: { id: guild },
        author: { id: U },
        content,
        mentions: { users: { size: 0 }, roles: { size: 0 }, everyone: false },
    });
    const c = { ...defaults, spam: true, maxMessages: 2, duplicates: true };
    assert.deepEqual(detect(message("one"), c, 1000), []);
    assert.deepEqual(detect(message("one"), c, 1100), []);
    assert.deepEqual(detect(message("two"), c, 1200), []);
    assert.deepEqual(detect(message("one"), c, 1300), ["spam", "duplicate message"]);
    assert.deepEqual(detect(message("one"), c, 10000), []);
    const bad = {
        ...message("three", "STOP HTTPS://DISCORD.GG/EXAMPLE BLOCKED"),
        webhookId: "webhook",
        mentions: { users: { size: 10 }, roles: { size: 0 } },
    };
    const reasons = detect(
        bad,
        {
            ...defaults,
            links: true,
            invites: true,
            mentions: true,
            caps: true,
            webhooks: true,
            badWords: ["blocked"],
        },
        1000,
    );
    assert.deepEqual(reasons, ["link", "invite", "mention spam", "caps", "webhook", "blocked word"]);
    assert.deepEqual(detect(bad, defaults, 1000), []);
});
test("moderation case retains actor, evidence and monotonic guild case number before log delivery", async () => {
    let data = {};
    let flushed = false;
    const db = {
        getGuild: () => data,
        updateGuild: (id, patch) => {
            data = { ...data, ...patch };
        },
        flush: async () => {
            flushed = true;
        },
    };
    const service = load("src/services/moderation/caseService.js", {
        "../../../utils/database": db,
        "../../../utils/logger": { ...silent, sendLog: async () => assert.ok(flushed) },
    });
    const guild = { id: G, client: {} };
    const first = await service.recordCase(guild, {
        action: "warn",
        actorId: U,
        targetId: G,
        reason: "Reason",
        evidence: "https://example.com/evidence",
    });
    const second = await service.recordCase(guild, { action: "timeout", actorId: U });
    assert.equal(first.number, 1);
    assert.equal(second.number, 2);
    assert.notEqual(first.id, second.id);
    assert.equal(data.moderationCases[0].evidence, "https://example.com/evidence");
});
test("ticket owner cannot claim another staff role; stranger cannot read transcript; duplicate claim preserves assignee", async () => {
    let record = { guildId: G, channelId: "channel", ownerId: U, status: "open", claimedBy: "staff-a" };
    let mutations = 0;
    const db = {
        getDB: () => ({ tickets: { channel: record } }),
        getGuild: () => ({ ticket: { supportRoleIds: ["support"] } }),
        save: async () => mutations++,
    };
    const service = load("src/services/tickets/ticketService.js", {
        "../../../utils/database": db,
        "../../../utils/logger": silent,
    });
    const base = {
        guildId: G,
        channelId: "channel",
        user: { id: U },
        member: { permissions: { has: () => false }, roles: { cache: new Map() } },
        reply: async (payload) => payload,
        editReply: async (payload) => payload,
        deferReply: async () => {},
    };
    assert.match((await service.handle({ ...base, customId: "ticket_claim" })).content, /staff/);
    assert.match(
        (await service.handle({ ...base, user: { id: "stranger" }, customId: "ticket_transcript" })).content,
        /owner/,
    );
    const staff = {
        ...base,
        user: { id: "staff-b" },
        member: { permissions: { has: () => true }, roles: { cache: new Map() } },
    };
    assert.match((await service.handle({ ...staff, customId: "ticket_claim" })).content, /Already claimed/);
    assert.equal(mutations, 0);
});
test("playlist rejects reserved keys before changing a profile", () => {
    const db = {
        getUser: () => ({ playlists: {} }),
        updateUser: () => {
            throw new Error("unexpected write");
        },
    };
    const music = load("utils/musicFeatures.js", { "./database.js": db, "./logger.js": silent });
    for (const name of ["__proto__", "constructor", "prototype"])
        assert.equal(music.createPlaylist(U, name).ok, false);
});
