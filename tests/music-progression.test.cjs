const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: flush } = require('node:timers/promises');
const { fixture, track } = require('./music-fixture.cjs');
const setup = async (t, options = {}, tracks = [track(1)]) => {
    const f = fixture(options);
    t.after(() => f.manager.close());
    f.channel = f.voice('guild');
    f.listener = f.member(f.channel);
    await f.manager.enqueue(f.channel, tracks, { member: f.listener });
    f.queue = f.manager.getQueue('guild');
    return f;
};
const drain = async f => { await flush(); await f.manager.run('guild', async () => {}); await flush(); };
const end = (f, data = {}) => f.queue.player.emit('end', {
    reason: 'finished', track: { ...track(1), userData: { playId: f.queue.playId }, ...data },
});

test('adding songs leaves active playback and deliberate pause untouched', async t => {
    const f = await setup(t);
    const player = f.queue.player;
    const play = player.playTrack;
    let starts = 0;
    player.playTrack = async opts => { starts++; return play(opts); };
    player.position = 42000;
    await f.manager.enqueue(f.channel, [track(2)], { member: f.listener });
    await f.queue.pause();
    await f.manager.enqueue(f.channel, [track(3)], { member: f.listener });
    assert.equal(starts, 0);
    assert.equal(player.position, 42000);
    assert.equal(player.paused, true);
    assert.equal(f.lavalink.joins, 1);
});

test('failed next track does not discard later queued songs', async t => {
    const f = await setup(t, {}, [track(1), track(2), track(3)]);
    const play = f.queue.player.playTrack;
    f.queue.player.playTrack = async opts => {
        if (opts.track.encoded === track(2).encoded) throw new Error('unplayable track');
        return play(opts);
    };
    end(f);
    await drain(f);
    assert.equal(f.queue.songs[0]?.name, 'Track 3');
    assert.equal(f.queue.player.track, track(3).encoded);
    assert.equal(f.lavalink.joins, 1);
});

test('rewritten encoded track events with our play token advance once and reject old tokens', async t => {
    const f = await setup(t, {}, [track(1), track(2), track(3)]);
    const token = f.queue.playId;
    end(f, { encoded: 'node-reencoded-track' });
    await drain(f);
    assert.equal(f.queue.songs[0]?.name, 'Track 2');
    f.queue.player.emit('end', { reason: 'finished', track: { ...track(2), userData: { playId: token } } });
    await drain(f);
    assert.equal(f.queue.songs[0]?.name, 'Track 2');
});

test('autoplay broadens search after duplicate-only results and excludes equivalent YouTube URLs', async t => {
    const f = await setup(t);
    f.queue.autoplay = true;
    const queries = [];
    f.node.rest.resolve = async query => {
        queries.push(query);
        return { loadType: 'search', data: queries.length === 1
            ? [{ ...track(1), info: { ...track(1).info, uri: 'https://youtu.be/1?si=test' } }]
            : [track(2)] };
    };
    end(f);
    await drain(f);
    assert.equal(f.queue.songs[0]?.name, 'Track 2');
    assert.equal(queries.length, 2);
    assert.notEqual(queries[0], queries[1]);
});

test('repeated failed autoplay tracks stop after a bounded number of candidates', async t => {
    const f = await setup(t);
    f.queue.autoplay = true;
    let candidates = 0;
    f.node.rest.resolve = async () => ({ loadType: 'search', data: [track(++candidates + 1)] });
    end(f);
    await drain(f);
    for (let i = 0; i < 4 && f.queue.songs.length; i++) {
        const q = f.queue;
        q.player.emit('exception', { track: { encoded: q.songs[0].encoded, userData: { playId: q.playId } } });
        await drain(f);
    }
    assert.equal(f.queue.songs.length, 0);
    assert.equal(candidates, 3);
});

test('bounded playback failures preserve pending requests and a later enqueue resumes the same player', async t => {
    const f = await setup(t, { maxQueueSize: 10 }, [track(1), track(2), track(3), track(4), track(5)]);
    const player = f.queue.player, play = player.playTrack;
    player.playTrack = async () => { throw new Error('bad source'); };
    end(f);
    await drain(f);
    assert.deepEqual(f.queue.songs.map(x => x.name), ['Track 5']);
    assert.equal(f.queue.paused, true);
    player.playTrack = play;
    await f.manager.enqueue(f.channel, [track(6)], { member: f.listener });
    assert.equal(player.track, track(5).encoded);
    assert.deepEqual(f.queue.songs.map(x => x.name), ['Track 5', 'Track 6']);
    assert.equal(f.lavalink.joins, 1);
});

test('node outages preserve all pending tracks and Resume retries without a new player', async t => {
    const f = await setup(t, {}, [track(1), track(2), track(3)]);
    const player = f.queue.player, play = player.playTrack;
    let attempts = 0;
    player.playTrack = async () => {
        attempts++;
        throw Object.assign(new Error('node unavailable'), { status: 503, code: 'LAVALINK_REQUEST_FAILED' });
    };
    end(f);
    await drain(f);
    assert.equal(attempts, 1);
    assert.deepEqual(f.queue.songs.map(x => x.name), ['Track 2', 'Track 3']);
    assert.equal(f.queue.paused, true);
    player.playTrack = play;
    await f.queue.resume();
    assert.equal(player.track, track(2).encoded);
    assert.equal(f.queue.paused, false);
    assert.equal(f.lavalink.joins, 1);
});

test('autoplay search failure has a fallback, and a pending Stop cancels its result', async t => {
    const f = await setup(t);
    f.queue.autoplay = true;
    let searches = 0;
    f.node.rest.resolve = async () => {
        if (++searches === 1) throw new Error('temporary search failure');
        return { loadType: 'search', data: [track(2)] };
    };
    end(f);
    await drain(f);
    assert.equal(f.queue.songs[0].name, 'Track 2');
    let release;
    f.node.rest.resolve = async () => new Promise(resolve => { release = () => resolve({ loadType: 'search', data: [track(3)] }); });
    f.queue.player.emit('end', { reason: 'finished', track: { ...track(2), userData: { playId: f.queue.playId } } });
    await flush();
    const stopping = f.queue.stop();
    release();
    await stopping;
    await drain(f);
    assert.equal(f.queue.songs.length, 0);
    assert.equal(f.queue.player.track, null);
});
