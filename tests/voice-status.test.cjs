const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VoiceStatusUpdater } = require('../src/music/VoiceStatusUpdater');
const { fixture, track } = require('./music-fixture.cjs');
const { silent } = require('./helpers.cjs');
const channel = id => ({ id, guild: { members: { me: {} } }, permissionsFor: () => ({ has: () => true }) });
const queue = vc => ({ id: 'guild', voiceChannel: vc, songs: [{ name: 'First song' }], paused: false });

test('voice status follows shared playback, pause, skip and clears before disconnect', async (t) => {
    const f = fixture();
    t.after(() => f.manager.close());
    const calls = [];
    f.manager.client.rest = { put: async (route, { body }) => calls.push({ route, status: body.status }) };
    const vc = f.voice('guild');
    await f.manager.enqueue(vc, [track(1), track(2)], { member: f.member(vc) });
    const q = f.manager.getQueue('guild');
    await f.manager.voiceStatus.update(q);
    assert.equal(calls.at(-1).status, '🎧 Playing • Track 1');
    const count = calls.length;
    await f.manager.notify(q);
    await f.manager.voiceStatus.update(q);
    assert.equal(calls.length, count);
    await q.pause();
    await f.manager.voiceStatus.update(q);
    assert.equal(calls.at(-1).status, '⏸ Paused • Track 1');
    await q.resume();
    await q.skip();
    await f.manager.voiceStatus.update(q);
    assert.equal(calls.at(-1).status, '🎧 Playing • Track 2');
    const leave = f.lavalink.leaveVoiceChannel;
    f.lavalink.leaveVoiceChannel = async id => {
        assert.equal(calls.at(-1).status, null);
        return leave(id);
    };
    await f.manager.leave('guild');
    assert.equal(f.lavalink.joins, 1);
});

test('status clears on empty queue and channel move; long titles stay within Discord limits', async () => {
    const calls = [];
    const updater = new VoiceStatusUpdater({ rest: { put: async (route, { body }) => calls.push([route, body.status]) } }, silent);
    const q = queue(channel('one'));
    q.songs[0].name = '🎵'.repeat(600) + '\nTitle';
    await updater.update(q);
    assert.ok(calls[0][1].length <= 500);
    assert.equal(calls[0][1].includes('\n'), false);
    q.voiceChannel = channel('two');
    await updater.update(q);
    assert.deepEqual(calls[1], ['/channels/one/voice-status', null]);
    assert.equal(calls[2][0], '/channels/two/voice-status');
    q.songs = [];
    await updater.update(q);
    assert.deepEqual(calls.at(-1), ['/channels/two/voice-status', null]);
});

test('late API writes are serialized and latest pause/stop state wins', async () => {
    const calls = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const updater = new VoiceStatusUpdater({ rest: { put: async (_, { body }) => {
        calls.push(body.status);
        if (calls.length === 1) await gate;
    } } }, silent);
    const q = queue(channel('one'));
    const first = updater.update(q);
    await Promise.resolve();
    q.paused = true;
    const paused = updater.update(q);
    const cleared = updater.clear('guild');
    release();
    await Promise.all([first, paused, cleared]);
    assert.deepEqual(calls, ['🎧 Playing • First song', null]);
});

test('missing permissions and REST failures do not fail playback and have a retry cooldown', async () => {
    let calls = 0, warnings = 0;
    const updater = new VoiceStatusUpdater({ rest: { put: async () => {
        calls++;
        throw Object.assign(new Error('denied'), { code: 50013 });
    } } }, { warn: () => warnings++ });
    const q = queue(channel('one'));
    q.voiceChannel.permissionsFor = () => ({ has: () => false });
    await updater.update(q);
    await updater.update(q);
    assert.equal(calls, 0);
    assert.equal(warnings, 1);
    q.voiceChannel = channel('two');
    await updater.update(q);
    await updater.update(q);
    assert.equal(calls, 1);
    assert.equal(warnings, 2);
});
