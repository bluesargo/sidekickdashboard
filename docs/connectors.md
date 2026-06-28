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

A sync step reads the credit balance from the Lovable connector and pushes it:

1. Call the Lovable connector `get_workspace` (use `list_workspaces` / `get_me`
   first if you have several) and read the workspace **credit balance**.
2. Push it:
   ```json
   [{ "provider": "lovable", "metric": "credits", "value": <balance>, "unit": "credits", "label": "Lovable credits" }]
   ```

Run it on whatever cadence you like:

- **On demand** — ask Claude in this environment: *"sync my Lovable credits to the
  dashboard."*
- **Scheduled** — a recurring agent task (cron) in this environment that performs
  the two steps above. Ask Claude to *"set up a recurring Lovable credit sync every
  6 hours"* and it can schedule it.

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
