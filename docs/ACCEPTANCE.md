# V4+++ acceptance status

This branch is an **integration preview**, not a claim that every item in the
master prompt has shipped or that live deployments have passed.

## Implemented, with local verification

| Area | Coverage |
| --- | --- |
| Legacy preservation | Original JSON retained; original command modules remain; additional prefix music adapters |
| Migration | Private backup, validation, normalization, atomic/idempotent import, counts and verification reports |
| Supabase runtime | Indexed normalized collections, compatibility cache, exclusive writer lease, transactional patches, stale-write rejection, audit records |
| Economy | Common daily/work rewards, consistent cooldowns, atomic transfer snapshots; SQL transfer RPC has idempotency/ledger checks |
| Games | Mines/Blackjack action lock and single settlement; interactive session/escrow persistence and restart restore |
| Music | Lavalink/Shoukaku engine, per-guild queue/locks, source validation, supported filters, reconnect, saved player restoration |
| Discord UX | Single persistent artwork panel, generated fallback, state controls, custom emoji fallback, volume modal, queue/lyrics pages |
| Dashboard | OAuth implementation, server selector/invite links, settings/greeting builder, music controller/search/enqueue, favorites/playlist editing, AutoMod, cases, tickets, audit, owner health/emoji configuration |
| Security | Guild permission rechecks, CSRF, signed HttpOnly sessions, HTTPS cookies in production, validation, CSP, body/rate limits, backend-only secrets |
| Community | Configurable welcome/goodbye, AutoMod rules, case records, ticket owner IDs/claims/close/reopen/transcripts/inactivity closure |
| Realtime | Same-process setting changes and music SSE; SSE listeners released on disconnect |
| Portable packaging | Lockfile, Render blueprint, Dockerfile, Pterodactyl/Railway/VPS instructions |

Local checks use PGlite PostgreSQL, mocked Discord/Lavalink transport and disposable
fixtures. Browser inspection used the real landing page and explicitly synthetic
in-browser player/builder state. No authentication bypass was added to the app.

## Live acceptance not yet passed

- Discord login, gateway events and real prefix/slash execution.
- Hosted Supabase schema application, import, lease, runtime queries and outage recovery.
- Lavalink voice/audio, source plugin compatibility, actual URL/search/playlist/filter
  playback, and real disconnect/reconnect/restart behavior.
- Discord OAuth redirects/cookies on the final HTTPS origin and real permission revocation.
- Live welcome/goodbye cards, moderation actions, new tickets and restored games.
- Render/Pterodactyl/Railway/VPS/Docker deployment and process restart under the host's limits.

The sandbox has no provider credentials/node configured. The installed emulator
catalog has no compatible Supabase, Discord or Lavalink emulator. SQL tests do not
substitute for these acceptance checks.

## Remaining implementation scope / limits

- The functional dashboard runs with the bot in one process. Separate production
  web workers, horizontal scaling, shared durable OAuth sessions and distributed
  command transport are not implemented. Only one runtime writer may be active.
- This compatibility runtime keeps full legacy profile/settings JSONB and normalized
  projections. It loads the current data set into memory and diffs snapshots;
  pagination/lazy repositories for very large installations are future work.
- Discord effects cannot be atomically committed with PostgreSQL. Network/process
  failure between a Discord action and its case/message persistence may require
  reconciliation. Migration and database-side writes remain transactional.
- Dedicated dashboard builders for button/select/temporary role panels, level reward
  rules, economy shop/reward editing, generic embeds, language/appearance settings,
  suggestions, integration management, and owner broadcast/maintenance/blacklist
  operations are not implemented. Existing Discord commands for these existing
  features remain available. No placeholder sidebar controls advertise them.
- Web search/enqueue and personal favorite/playlist editing are implemented. Playing
  an entire saved personal playlist remains a Discord command; the web can enqueue
  source playlist URLs. Personalized button state on a shared Discord panel,
  configurable panel themes, and synchronized browser audio are not implemented.
- Ticket dashboard provides configuration and panel publication; multiple ticket
  categories/select templates and a full staff web inbox are future work. Existing
  legacy ticket channels require staff handling; new tickets use durable owner IDs.
- Cards retain the existing canvas renderer; arbitrary background image composition,
  generic embed fields/author/footer editing and per-guild card layout themes remain.
- Command strings are still partly legacy Indonesian and new dashboard English;
  a full localization catalog and every legacy embed conversion are outstanding.
- Sleep timers are in memory; they do not resume after a process restart. Player
  queue recovery is best effort and limited to snapshots younger than 24 hours.
  Encoded tracks may expire or become invalid after node/plugin changes.
- Minimum Node version is 20.12 (native environment-file loading). Use Node 22/24
  for new deployments. The Supabase SDK is pinned to a Node 20-compatible release.
- Echo is not offered as a Lavalink filter because there is no equivalent native
  filter in the selected API. YouTube/Spotify require real source plugins.

Use this status to plan the next implementation/acceptance pass; do not mark all
master-prompt checklist items complete from local tests alone.
