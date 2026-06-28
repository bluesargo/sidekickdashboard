# Lovable & Replit via connectors

Claude (Codex, Cursor) usage lives in **local CLI files / provider APIs**, so the
[collector](collector-setup.md) handles them on your dev machine. **Lovable and
Replit are different** — neither has a public usage/credits REST API the collector
could call:

- **Lovable** — credit balance is only exposed through the **Lovable MCP
  connector** (`get_workspace` returns the workspace plan + credit balance).
- **Replit** — the Replit MCP connector only manages apps (`list_apps`); it
  exposes no usage/credit endpoint.

MCP connectors run inside your **Claude/agent environment**, not in the standalone
collector or the Vercel server. So these two are refreshed by a **connector sync**
that runs where the connectors live, and pushes values to the same
`POST /api/ingest` endpoint everything else uses.

## The push helper

`scripts/push-metrics.mjs` sends arbitrary metrics to the dashboard:

```bash
DASHBOARD_URL=https://your-app.vercel.app INGEST_TOKEN=xxx \
  node scripts/push-metrics.mjs '[
    {"provider":"lovable","metric":"credits","value":120,"unit":"credits","label":"Lovable credits"}
  ]'
```

It accepts a metrics array or a full `{source, metrics}` payload, and defaults the
source to `connector`.

## Lovable (automated via connector)

The [`lovable-sync` skill](../.claude/skills/lovable-sync/SKILL.md) reads
`get_workspace` and pushes the credits. Field mapping (confirmed against a real
workspace):

| Pushed metric | From `get_workspace` field |
|---|---|
| `credits` (remaining) | `max(0, billing_period_credits_limit - billing_period_credits_used)` |
| `usage_pct` | `billing_period_credits_used / billing_period_credits_limit * 100` |
| `credits_used` | `billing_period_credits_used` |
| `credits_limit` | `billing_period_credits_limit` |
| `detail.resets_at` | `next_monthly_credit_grant_date` (drives the "resets in …" line) |

Run it:

- **On demand** — *"sync my Lovable credits to the dashboard."*
- **Every 6 hours** — schedule the skill with CronCreate (`"13 */6 * * *"`).

> Durability note: CronCreate jobs run inside a Claude session. A Claude Code
> **web** session runs in an ephemeral container that is reclaimed on inactivity,
> so for a real always-on 6-hour sync run the skill from a persistent Claude
> surface (e.g. Claude Code on your own machine, where the Lovable connector is
> authorized). The sync also needs the dashboard deployed so `DASHBOARD_URL` /
> `INGEST_TOKEN` exist to receive the push.

## Replit

No usage/credit data is available via the connector, so Replit stays **manual**:
enter the balance in `/admin`, or set `REPLIT_BALANCE_USD` in the collector env.
(If you want, the connector's `list_apps` count can be pushed as
`replit.app_count` for an at-a-glance tile — it just isn't a usage/credit figure.)

## Why not put this in the collector?

The collector is a plain Node process with no MCP client or connector OAuth, so it
can't reach Lovable/Replit. Keeping the connector sync in the Claude environment
(where the connectors are already authorized) avoids re-implementing and storing
those credentials elsewhere. Everything converges on `/api/ingest`, so the device
and web preview don't care which path a value came from.
