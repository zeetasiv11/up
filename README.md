# Zeechei V4+++

An upgrade of the existing Zeechei bot: Discord.js v14, a shared web dashboard,
Supabase persistence, and Lavalink v4 music. The existing command modules remain;
new services replace the playback engine and provide a compatibility layer for
legacy data access.

**Release status: integration preview.** Local regression/SQL/browser checks are
available. Real Discord login, Supabase hosting, OAuth callbacks, Lavalink audio,
and cloud deployments still require operator configuration and acceptance testing.
See [acceptance status](docs/ACCEPTANCE.md) for remaining features and limits.

## Architecture

```text
Discord commands / events ─┬─ MusicManager → Shoukaku → external Lavalink v4
                          ├─ Community / moderation / ticket / economy services
OAuth dashboard + API ────┤
                          └─ database compatibility service → RuntimeRepository
                               → atomic PostgreSQL RPC → normalized Supabase tables

MusicManager → SSE → web player
MusicManager → one persistent Discord message per guild
```

The functional bot and dashboard share **one Node process and one database**.
`WEB_ENABLED=false` runs the bot with health endpoints only. No Java, yt-dlp,
local FFmpeg playback, Docker, or PM2 is required on the bot host.

The compatibility service deliberately keeps the original command interfaces.
In Supabase mode, startup hydrates a runtime cache from PostgreSQL; mutations are
validated, diffed, and committed across normalized tables in a single transaction.
A renewable lease permits one active bot writer. Revision checks, row comparisons,
and retry IDs prevent stale writes and duplicate commits. Failed writes pause
access; they never switch production storage to JSON. The cache is not a backup.

## Requirements

- Node **20.12+**, with Node 22/24 recommended for deployment. Supabase SDK 2.99.2
  is pinned to retain Node 20 compatibility.
- Discord application with Guild Members and Message Content intents enabled.
- Supabase project with the SQL below applied and legacy data imported.
- External Lavalink v4 node and the source plugins you need.
- HTTPS public URL for a production OAuth dashboard.

## Install and configure

```sh
npm ci
cp .env.example .env
```

Fill `.env` privately; platform environment variables take precedence. Never paste
credentials into `settings.js`, source files, logs, screenshots, or browser code.
`settings.js` now holds global defaults; guild overrides live in the database.

| Variables | Purpose |
| --- | --- |
| `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_IDS` | Bot credentials, application ID, comma-separated owner IDs |
| `DATABASE_BACKEND=supabase` | Production persistence; `legacy` is an explicit recovery/development option |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Backend database access; never sent to browser |
| `SUPABASE_ANON_KEY` | Reserved; dashboard does not need direct Supabase access |
| `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `LAVALINK_SECURE` | External node connection |
| `LAVALINK_SEARCH_SOURCE` | `ytsearch`, `ytmsearch`, or `scsearch` |
| `LAVALINK_ALLOWED_URL_HOSTS` | Additional explicitly trusted audio hosts |
| `WEB_ENABLED`, `WEB_URL`, `PORT` / `WEB_PORT` | Optional dashboard, public origin, listening port |
| `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | OAuth secret and at least 32 characters of session signing entropy |
| `DISCORD_REDIRECT_URI` | If set, must equal `WEB_URL/api/auth/callback` |
| `MUSIC_EMOJI_*` | Real guild-owned custom emoji markup; optional |
| `NODE_ENV`, `LOG_LEVEL` | Production behavior and structured log verbosity |
| `SETUP_MODE` | Opt-in public setup page while required credentials are missing; no bot/database initialization |
| `LEGACY_DATABASE_PATH` | Explicit legacy rollback file; never used by Supabase runtime |

## Database and migration

Read [UPGRADE_V4.md](UPGRADE_V4.md) before moving live data. Stop the old writer and
keep an independent backup. Apply these files in order through Supabase SQL editor:

1. `database/supabase/schema.sql`
2. `database/supabase/runtime.sql`

```sh
npm run db:migrate -- --dry-run
node scripts/validate-env.js database
npm run db:migrate
npm run db:validate
```

Import validates the original JSON, creates an exact-byte private backup, normalizes
collections, imports in one transaction, verifies rows, and writes an aggregate
report. Repeating the same snapshot is a no-op. Conflicting snapshots roll back;
existing balances are never reset by a migration upsert. Backups/reports are under
`database/legacy/` and ignored by Git. The original `database/database.json` stays.

Tables cover guilds/settings, users/profiles/economy, inventory, animals, pets,
weapons, quests, achievements, marriages, statistics, music favorites/playlists,
panels/history, reaction roles, bosses, warnings/cases, tickets, reminders, AFK,
blacklist, lottery, audit logs and transaction receipts. Full profile/settings
JSONB retains legacy extension fields; related collections have indexed tables.
Active game snapshots remain in profile JSONB. See the SQL for exact columns.
Anon/authenticated browser roles cannot read or write these tables/RPCs.

## Run

```sh
node scripts/validate-env.js bot
node scripts/music-health.js
npm start
```

For the dashboard set `WEB_ENABLED=true`, configure OAuth, and run the same
`npm start`. `PORT` takes priority over `WEB_PORT` (default 3000).

`npm run start:web` serves a standalone login shell for frontend inspection in
legacy development mode. It has no Discord gateway/music worker and cannot manage
live guilds. It is **not** a second production web deployment.

## Discord and OAuth setup

1. Create a Discord application; configure its bot token and application ID.
2. Enable Guild Members and Message Content intents in the developer portal.
3. Invite the bot with permissions needed by enabled features; slash registration
   runs on ready. `GUILD_ID` optionally restricts registration to a test server.
4. Add exactly `https://YOUR_HOST/api/auth/callback` to OAuth redirect URLs.
5. Set `WEB_URL=https://YOUR_HOST`, `DISCORD_CLIENT_SECRET`, and a random
   `SESSION_SECRET` of at least 32 characters. Generate one with
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
6. Login requests `identify guilds`. Only manageable guilds appear; every guild API
   operation rechecks Manage Server/Administrator permissions against Discord.

OAuth state is single-use and bound to a signed HttpOnly cookie. Sessions have a
30-minute maximum lifetime, are held server-side, and are lost on restart. Writes
require same-origin CSRF tokens. Production cookies require HTTPS. The API also
uses body limits, rate limits, strict validation, CSP, and feature permission checks.
Music controls additionally require the user's current voice channel and DJ access.

## Music experience

- Lavalink playback via Shoukaku; original slash commands preserved.
- `zplay`, `zpause`, `zresume`, `zskip`, `zstop`, `zqueue` share slash command logic.
  Replace `z` with the guild's configured prefix.
- Search selection, playlist enqueue, previous/pause/skip/replay, volume/seek,
  loop/autoplay, favorites/playlists/history and supported native filters.
- Single saved Discord panel, artwork and generated fallback, state-aware buttons,
  volume modal, queue/lyrics pagination, animated custom emoji with safe fallback.
- Updates on state changes and 15-second progress ticks; duplicate payloads skipped.
- Web player with live SSE state, queue removal/clear, volume/seek, filters and controls.
- Saved queue/position/filter/pause state can restore after restart (snapshots under
  24 hours old). Transient node recovery and voice-guard retries are best effort.

Source availability depends on the actual node/plugins. Read [Lavalink setup](docs/LAVALINK.md).
The dashboard never streams audio to the browser; audio stays in Discord voice.

## Community and existing features

All original slash and prefix modules remain, including economy, RPG inventory,
pets/animals, quests, achievements, marriage, games, leveling, reaction roles,
moderation, owner tools, welcome/goodbye and logs.

New dashboard modules include overview, greeting builders, prefix/log/autorole/
leveling/24-7 settings, AutoMod, moderation cases, ticket settings/panel publishing,
music control/history/favorites/playlists, configuration audit, owner health and
music emoji preferences. Search and confirm tracks or source playlists from the web;
select a Discord text channel for the persistent panel. Search selections expire
after two minutes and recheck voice/DJ permissions before enqueueing. Personal
favorites and playlists can be edited from either Discord or the dashboard; stale
web edits are rejected until the library is refreshed.

Greeting settings apply immediately and support template variables, embeds,
colors, images, member avatars, generated cards, link buttons and welcome DMs.
AutoMod supports spam/link/invite/mention/caps/duplicate/webhook/word checks and
join age/mass-join/raid rules. Destructive join actions require explicit configuration.
Tickets use stable owner IDs, staff claims, non-destructive close/reopen, inactivity
closure and plain-text transcripts (latest 5,000 messages maximum).

Daily/work rewards now share one service across slash/prefix commands. Daily base
reward follows the existing slash default (50,000); work cooldown follows the
existing global setting (one hour). Mines/Blackjack settlement is protected from
concurrent button clicks. Interactive Mines/Blackjack/HighLow/Hunt sessions are
persisted and restored; original timeout policies still apply after downtime.

## Deployment

- **Render:** [RENDER_DEPLOY.md](RENDER_DEPLOY.md), blueprint `render.yaml`.
- **Pterodactyl:** Node 22.12+/24 egg, `npm ci --omit=dev`, startup `npm start`.
  Inject environment variables; expose the assigned port as `PORT` for the optional
  dashboard. Use external Supabase/Lavalink. No systemd/PM2/Docker requirement.
- **Railway / VPS:** same install/start commands, one always-on instance, public
  HTTPS origin for OAuth, platform `PORT`, external Supabase/Lavalink.
- **Docker:** `docker build -t zeechei .`, then
  `docker run --env-file .env -p 3000:3000 zeechei`. Apply migrations separately
  before startup. Image intentionally excludes legacy player JSON and private env.

One active writer is required. During rolling deployment, drain the previous
instance before starting the replacement. A crashed lease expires after 90 seconds.
Do not scale replicas or point a separate service-role writer at these tables while
this compatibility runtime is active; unexpected row changes fail closed.

## Health, shutdown, testing

`GET /health` and `/api/health` report bot/database/backend/Lavalink/uptime without
secrets. `/ready` returns 503 when required services are unavailable. Liveness
endpoints return 200 even when degraded. SIGTERM/SIGINT stop HTTP acceptance,
drain current handlers, save player state, disconnect voice, flush/release database
ownership, then destroy Discord. A 20-second deadline bounds shutdown.

```sh
npm test
npm run check
npm run db:migrate -- --dry-run
```

Tests use disposable synthetic storage, protocol doubles, real local PostgreSQL
through PGlite, and local HTTP requests. They do not claim live provider acceptance.

## Troubleshooting

- **Database startup fails:** apply both SQL files, import before startup, verify
  service-role environment. Never enable legacy mode to conceal a production error.
- **Writer lease held:** stop the old instance; after a crash wait up to 90 seconds.
- **Concurrent row/version failure:** stop external writers, inspect audit records,
  restart to reload canonical state. Do not overwrite newer rows with an old JSON file.
- **OAuth state error:** restart login, check exact public origin/redirect and secure
  cookie configuration. A restart invalidates existing sessions.
- **403 controls:** verify Manage Server, feature permissions, same voice channel
  and DJ role. A client-supplied guild ID is never sufficient authorization.
- **Source not available:** check Lavalink `/v4/info`, plugins, source credentials,
  connectivity and allowed URL hosts. Source/plugin errors stay in server logs.
- **Migration mismatch after live use:** expected snapshot differs from current data;
  do not reimport to reset accounts. Rehearse against an isolated project.

See [acceptance status](docs/ACCEPTANCE.md) for the remaining implementation scope.

### First deployment without credentials

Set `SETUP_MODE=true` only when deploying the initial configuration page. `npm start`
serves the public landing page if required bot/database/dashboard environment values
are missing. No commands, authenticated APIs or database are loaded, and `/health`,
`/api/health` and `/ready` return HTTP 503 with `configuration_required`. A reachable
page is not evidence that the bot is online. Fill Environment privately, apply SQL
and migrate data, then redeploy; the same startup command launches the full app
when the required values are present. Set `SETUP_MODE=false` for normal operation.
A Render Free service can spin down and is only suitable for this initial preview;
choose an always-on plan before depending on continuous Discord availability.
