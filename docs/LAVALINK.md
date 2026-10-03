# Lavalink music backend

Playback now uses Shoukaku 4.3.0 against Lavalink v4. DisTube, yt-dlp,
RapidAPI and the local FFmpeg resolver are removed from the playback path.
`client.distube` is a compatibility name for MusicManager, not a DisTube instance.

Run a separate Lavalink v4 node and configure:

```dotenv
LAVALINK_HOST=your-node-hostname
LAVALINK_PORT=2333
LAVALINK_PASSWORD=your-private-node-password
LAVALINK_SECURE=false
LAVALINK_SEARCH_SOURCE=ytsearch
```

Use TLS (`LAVALINK_SECURE=true`) when your endpoint supports it. Restrict access to
the node; do not expose its password in a frontend. Java belongs on the node host,
not on Render/Pterodactyl's bot process. Use the Lavalink release's own supported
Java version and example application.yml.

- Official server/config: https://lavalink.dev/configuration/config/file.html
- YouTube source plugin: https://github.com/lavalink-devs/youtube-source
- Spotify resolution and additional sources: https://github.com/topi314/LavaSrc

YouTube/YouTube Music need the node's supported source plugin. Spotify URLs need a
compatible resolver/plugin and any credentials required by that plugin; this is
not native Spotify audio streaming. SoundCloud/search availability follows the
node's source configuration. The bot does not install or configure server plugins.

Direct audio hosts must be explicitly listed in `LAVALINK_ALLOWED_URL_HOSTS` and
supported by the node. Defaults allow YouTube, SoundCloud and Spotify hosts only;
IP literals and credential-bearing URLs are rejected. If enabling arbitrary HTTP
sources, isolate the Lavalink node from private network/metadata endpoints and
restrict its outbound network. URL redirects are resolved by the node, so a bot
hostname allowlist alone is not a network isolation boundary.

```sh
node scripts/music-health.js
```

This checks `/v4/info` and prints version/source/filter/plugin capabilities without
secrets. It does not prove Discord voice/audio delivery. `/play` query searches show
up to five selectable results; URLs and playlists are enqueued in one operation.
Queue modifications are isolated per guild. Playback actions await node responses.

Bassboost/pop/treble use equalizer, nightcore/vaporwave use timescale, 8D/rotation
use rotation, and karaoke/tremolo/vibrato/lowpass/distortion use native Lavalink
filters. The panel only offers effects advertised by the connected node. Legacy
Echo has no equivalent native Lavalink filter and is intentionally not offered.

The connection requests server-side resume (60 seconds) and enables library-side recovery.
If a shared node rejects the optional session-resume setting with HTTP 403,
the bot records a warning and uses library-side recovery; playback authorization
failures still propagate. Seamless server-side resume is unavailable on that node.
Node source/filter capabilities are fetched before restoring saved player settings.
The client reconnects
with bounded automatic reconnect attempts. Queue state survives a transient node
connection interruption while this bot process is alive. Voice guard retries
forced voice disconnects when enabled. Queue, position, volume, loop, autoplay, pause and filter snapshots are persisted
and restored on node ready after process restart when younger than 24 hours.
Encoded tracks can expire or become incompatible after a node/plugin upgrade;
restoration is best effort. Persistent panel message recovery is also implemented. Live reconnect/audio verification is still needed.
