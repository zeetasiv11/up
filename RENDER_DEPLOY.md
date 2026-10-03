# Render Blueprint: always-on bot and dashboard

`render.yaml` manages the existing **zeechei-v4-dashboard** service. It uses a paid
`0.5c-512mb` compute plan (0.5 CPU / 512 MB, listed at **US$7/month** on 2026-10-02,
excluding other usage and taxes), one instance, and the Singapore region.

A Blueprint is infrastructure configuration, not a compute/service type. This
application keeps the Discord gateway and dashboard in one Node process, so the
Blueprint uses `type: web`. Paid Web Services do not have Free's idle spin-down.
Splitting this implementation into a worker and a separate web process would need
shared command transport and sessions that are not implemented yet.

References: [Blueprints](https://render.com/docs/infrastructure-as-code),
[compute pricing](https://render.com/pricing), [Free limits](https://render.com/docs/free).

## Apply the prepared Blueprint

1. Open Render in **zeta's workspace** and choose **New + → Blueprint**.
2. Select repository `ijalxiaomi65-source/up` and branch
   `coderabbit/upgrade-zeechei-v4-music-dashboard/7c79d5d0`.
3. Use Blueprint Path `render.yaml`. Prefer **Auto Sync: No** while configuring
   database migration and deployment sequencing.
4. Review the plan: it should adopt/update the existing service
   `zeechei-v4-dashboard` (`srv-davm8uad0e5s738hudog`), changing its compute plan
   from Free to `0.5c-512mb`. Confirm the displayed price before **Deploy Blueprint**.
   If it proposes an additional service, check the workspace and exact name first.
5. A source-file push alone does not attach the service to a Blueprint or change
   the live compute plan. The Blueprint must be created/synced in Render.

The connected Render MCP currently supports creating services and triggering
service deployments, but not creating/syncing Blueprints or changing compute
plans. Those operations need the Dashboard or an authenticated REST API route.

## Environment and first setup

The existing service's `SETUP_MODE=true` is retained by `sync: false`. Secrets and
node connection values are also preserved; `SESSION_SECRET` is generated only if
it does not already exist. No credentials are stored in the Blueprint.

- Fill `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_IDS`, and `DISCORD_CLIENT_SECRET`.
- Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Fill `LAVALINK_HOST` and `LAVALINK_PASSWORD`; verify `LAVALINK_PORT` and
  `LAVALINK_SECURE` match your external node. Current setup defaults are 443/true.
- Register `https://zeechei-v4-dashboard.onrender.com/api/auth/callback` in Discord.
- Enable Server Members and Message Content intents in Discord Developer Portal.

Before starting the real bot:

1. Back up the latest old bot data; stop the old bot before migration/cutover.
2. Apply `database/supabase/schema.sql` and `runtime.sql` to Supabase.
3. Run `npm run db:migrate`, then `npm run db:validate` against that database.
4. Set `SETUP_MODE=false` in Render Environment, then deploy.
5. Confirm `/ready`, Discord commands, OAuth, settings save and audio playback.

The initial Blueprint uses `/` as its HTTP health check so the requested public
setup page stays deployable before credentials are supplied. During setup,
`/health`, `/api/health` and `/ready` return 503 and the bot is not running.
After completing integration acceptance, change `healthCheckPath` to `/ready`.
A reachable setup page never proves that Discord, Supabase or Lavalink is ready.

## Deployment sequencing

The app builds with `npm ci --omit=dev` and starts with `npm start`, using Node
24.14.1. Render supplies `PORT`; the app binds `0.0.0.0`. Supabase and Lavalink are
external. No persistent disk is needed for the Supabase runtime.

`numInstances: 1` and `autoDeployTrigger: off` are deliberate: the compatibility
runtime permits only one active writer. With `RUNTIME_HANDOFF=true` and Render's
health check at `/`, a replacement waiting for the lease serves process liveness
so Render can retire the old process. `/ready` and all application APIs remain
503 during this handover. The new bot waits for release/expiry (up to 90 seconds)
and loads the latest database snapshot before starting Discord. It never steals
an active lease. The wait is bounded to three minutes; other database failures
still stop startup immediately. This can briefly interrupt dashboard availability.
Do not enable replicas. With handover disabled, stop the old process first.

This avoids idle sleep, but it is not a guarantee of uninterrupted availability:
maintenance, manual deploys, configuration failures and provider outages still
need handling. Monitor actual bot readiness separately from the public web page.
