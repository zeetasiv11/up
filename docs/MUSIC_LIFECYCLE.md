# V4 music lifecycle

The target is `zeetasiv11/up`. The task was clarified to proceed with this repository.
Its installed music stack is Shoukaku 4.3.0, Discord.js 14.27.0 and Lavalink v4.
No separate known-working Lavalink reference was supplied or imported. The fixes
use the existing V4 manager and the actual installed Shoukaku API/event model.

## Ownership

- `client.music` owns guild MusicQueue state and lifecycle operations.
  `client.distube` is a compatibility alias for that same manager.
- One Shoukaku instance owns its guild player/voice registries and node reconnection.
- Commands, prefix commands, buttons, filters and dashboard call the same queue.
- Creation is serialized per guild and concurrent joins share one promise.
- Controls recheck queue identity, current member/bot voice and DJ permissions
  when they acquire the guild lock. Opening a panel/dashboard never creates a player.
- Search runs before voice negotiation. Empty/error/malformed results never join
  voice. `/play` uses the first valid text-search result immediately. Dashboard
  searches preserve their expiring, user-bound selection flow.

## Playback and state

MusicQueue stores the current track at index 0 and upcoming tracks after it.
Track events validate queue identity, track identity, playback generation and,
when returned by the node, `userData.playId`. Shoukaku player events are `start`,
`end`, `exception`, `stuck`, `closed`, `update` and `resumed`; V4 uses these names
rather than names from another client. Progress comes from Shoukaku playerUpdate
state and the existing 15-second panel tick. Exception/stuck advances at most once
for the matching playback generation. Natural finish respects loop/queue/autoplay.

Volume, seek and filters use Shoukaku `update(..., true)` with the current pause
flag. Shoukaku 4's convenience update path otherwise resets its local pause flag.
Filter replacement also replaces its local filter cache, so cleared filters are
not restored during node recovery. Stop clears songs and invalidates track events;
Discord and dashboard honor the same `leaveOnStop` policy.

Panels retain V4's theme/components and coalesce updates for 250 ms. Each accepted
request and successful track change moves the panel to the bottom of the latest
request channel: delete the previous panel, then send and persist its replacement.
If deletion fails, no replacement is sent. Progress, pause, volume, and other state
updates edit the existing message; they do not move it. Payloads read current manager
state after Discord fetches. Duplicate edits are skipped. Startup restoration reads
the saved panel without moving it or joining voice.
SSE and dashboard state come from the same manager.

Voice channels show `🎧 Playing • title` or `⏸ Paused • title` from the same queue.
Stop, queue exhaustion and disconnect clear the bot's status; moving voice channels
also attempts to clear the old channel. Discord requires **Set Voice Channel Status**,
plus **Manage Channels** to clear a channel after the bot has already moved away.
Status writes are serialized/coalesced, unchanged values are skipped, and errors
have a 60-second retry cooldown without interrupting music. This feature does not
rename channels or connect a player.

## Voice recovery

Normal startup does not join voice. Saved playback restores only when `musicMode247`
or `vcGuard.enabled` explicitly opts in and the saved state is not suspended.
The Discord ready event restores panels; node ready loads source/filter capabilities
then reconciles/restores players. This is the only application startup join owner.

On unexpected voice disconnect, normal mode cleans up. Persistent mode schedules
one recovery job per guild, preserving queue, position, pause, volume, loop,
autoplay, filters and history. Retries are bounded to five attempts with delays
of 5, 10, 15, 20 and 25 seconds. A replacement is created only after releasing the
old library connection. Late events from the previous player are ignored.

Explicit stop/leave cancels the job immediately and persists suspension. Recovery
checks cancellation both before and after voice negotiation. Voice guard utility
calls delegate to MusicManager and do not run their own reconnect timers.
A Shoukaku Node subclass fixes the 4.3 reconnect loop retaining an earlier error
after a later successful handshake. A small subclass of the same Shoukaku client installs it through `addNode`;
Shoukaku 4.3 has structure hooks for REST/player, but has no node structure hook.
The player structure catches later voice REST updates, whose promises Shoukaku
does not await, and reports failures to the same MusicManager recovery owner.
Initial join failures still reject and clean up the partial voice handshake.
The client retains the same session/player registry and bounded node retry owner.
Shoukaku node reconnection continues to own transient node transport recovery;
V4 reconciles missing library players after ready without creating a competing node
client. Shutdown disables node retries before intentionally removing sockets.

`leaveOnEmptyCooldown` and `leaveOnFinishCooldown` are honored. The timeout rechecks
guild player identity, occupancy/queue and persistent mode before disconnecting.
24/7/voice guard prevents automatic idle cleanup; disabling persistent mode cancels
voice recovery without joining a channel.

## Verification

`tests/music-lifecycle.test.cjs` covers command/queue/control/recovery races with
synthetic players and fake timers. `tests/music-protocol.test.cjs` uses the actual
Shoukaku connector/player against a local HTTP/WebSocket Lavalink protocol fixture
and synthetic Discord gateway packets. It verifies one handshake, REST playback,
pause preservation, queue reuse, a failed reconnect handshake followed by successful
node resumption, and shutdown. `tests/music.test.cjs` covers panel
identity, payload limits, coalescing and active-state rendering. Existing web,
Supabase persistence, migration, authorization and startup suites remain required.

Local fixtures do not deliver audio or prove node source plugins and real Discord
voice transport. Live `/play` audio and real outage/reconnect acceptance require a
configured Discord test guild and Lavalink node; these remain operator checks.
