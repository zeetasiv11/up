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
secrets. It does not prove Discord voice/audio delivery. `/play` query searches play the first valid result immediately; URLs and playlists
are enqueued in one operation. Dashboard searches retain their result-selection UI.
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
Shoukaku owns node reconnection, with bounded automatic reconnect attempts and
library/server resumption. Queue state survives transient node interruption while
this process is alive. MusicManager exclusively owns recovery after a Discord
voice disconnect, with one pending recovery per guild and at most five attempts.
Only explicitly enabled 24/7 or voice guard may recover or join on startup.
Stop/leave cancels pending recovery, including an in-progress join, and saves a
suspension marker. Another explicit play/guard request resumes the lifecycle.
Queue, position, volume, loop, autoplay, pause and filter snapshots are persisted;
playback snapshots younger than 24 hours restore only in persistent modes.
Encoded tracks can expire or become incompatible after a node/plugin upgrade;
restoration remains best effort. See [music lifecycle](MUSIC_LIFECYCLE.md) for
ownership, Shoukaku event names, and verification boundaries.
