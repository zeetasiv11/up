# V3 → V4+++ upgrade procedure

This branch is an integration preview. Keep V3 and its backup available until
real Discord, database, music and dashboard acceptance checks pass.

## 1. Freeze and back up V3

Stop the old bot. Copy `database/database.json` to independent private storage.
Never run the old JSON writer and the new production writer against diverging data.
Use Node 20.12+; keep the original source JSON unchanged.

```sh
npm ci
cp .env.example .env
npm run db:migrate -- --dry-run
```

Dry-run needs no Supabase credentials. It validates structure/IDs/amounts, retains
unknown fields, creates a SHA-256-addressed backup with private file permissions,
and writes a counts/status report in ignored `database/legacy/` storage.

## 2. Configure Supabase

Rehearse with a separate Supabase project first. Apply, in order:

- `database/supabase/schema.sql`
- `database/supabase/runtime.sql`

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_BACKEND=supabase`.
Service-role credentials stay on the backend. No browser Supabase policy is needed.

```sh
node scripts/validate-env.js database
npm run db:migrate
npm run db:validate
```

On a host without a command shell, after applying both SQL files, explicitly set
`MIGRATE_LEGACY_ON_START=true` for the first deployment. `npm start` imports and
verifies the retained `database/database.json` before starting Discord. Startup
stops if import or verification fails. An existing `legacy_imports` receipt skips
the bootstrap import so later restarts never restore old balances. Set this flag
back to `false` after success. The ordinary migration commands remain available.
Copy the private migration report and backup out of ephemeral hosting storage
when needed; Supabase also retains the original snapshot and import receipt.

Import is atomic and fingerprint-idempotent; primary-key conflicts roll everything
back. It never overwrites existing accounts. Verify the generated report, every
row count, balances/bank, inventory/animals/pets/quests, relationships, favorites,
playlists, guild settings, warnings, tickets, reminders, AFK, stats and lottery.
The report contains aggregates; raw archived records remain private.

The source's economy/XP is global per user; migration preserves those semantics.
Quest containers retain date/reroll state and the entire list. Full profile and
guild JSONB retains fields used by existing services, with normalized projections
for related collections. Imports are one payload; large installations must rehearse
provider request/statement limits before using this compatibility runtime.

## 3. Configure Lavalink

Use an external Lavalink v4 node, with source plugins enabled on the node host.
Set host/port/password/TLS variables. See [Lavalink setup](docs/LAVALINK.md).

```sh
node scripts/music-health.js
```

This verifies node capabilities, not actual Discord audio. No yt-dlp cookies,
RapidAPI keys, Python or local playback FFmpeg are used.

## 4. Configure bot and OAuth

Set Discord token/application/owner IDs and enable required gateway intents.
Set `WEB_ENABLED=true`, public HTTPS `WEB_URL`, OAuth client secret and random
session secret. Register exactly `WEB_URL/api/auth/callback` in Discord's portal.
Keep `WEB_ENABLED=false` if deploying only the bot.

## 5. Start and verify

```sh
node scripts/validate-env.js bot
npm start
```

Startup loads Supabase before commands/events or login. No legacy file is read or
written in Supabase mode. Dashboard and Discord share the same service/cache;
successful settings saves are persisted before acknowledgement, without restart.
A database error fails closed. Only one bot process may hold the writer lease.

Verify commands, existing prefix aliases, rewards, safe transfers, games, welcome,
autoroles, moderation, tickets, reaction roles, and logout/permission revocation.
Then test `/play`, search/URL/playlist, filters, queue, node disconnect/reconnect,
process restart, persistent panel identity, and dashboard voice controls.

Saved interactive games restore their IDs and original expiration policy. Mines
may expire without a payout; Blackjack resolves its standing hand; HighLow refunds
on expiry; expired Hunt encounters disappear. A crash during external Discord
message delivery can still leave a message needing manual cleanup.

## 6. Rollback

Stop V4 first. Retain a database export of **current** Supabase records before any
rollback. The original JSON is only a pre-upgrade backup and is stale after live
use. Reverting to it would discard later progress; do not do that automatically.

For a rehearsal using untouched data, explicitly set `DATABASE_BACKEND=legacy`
and `LEGACY_DATABASE_PATH` to a copy of the backup. A missing configured file fails
startup. Supabase outages never trigger automatic JSON fallback.

## Acceptance

[docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) distinguishes implemented/local-tested
behavior, provider-dependent acceptance, and still-unimplemented advanced features.
