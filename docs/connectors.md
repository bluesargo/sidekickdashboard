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

The [`lovable-sync` skill](../.claude/skills/lovable-sync/SKILL.md) does this.

**Important data-source caveat:** the connector's `get_workspace` only returns the
monthly **grant size** (`billing_period_credits_limit`), cumulative period usage,
and `next_monthly_credit_grant_date`. It does **not** expose the spendable ledger
the Lovable UI shows (monthly / top-up / rollover / daily build credits / total),
and its `used`/`limit` numbers don't reconcile to the spendable total. So:

- The routine sources the **monthly grant size + reset date** automatically.
- The exact spendable buckets come from either occasional `/admin` entry (they only
  change at known reset dates) or a logged-in browser read. See the skill.

The dashboard models the buckets as separate metrics (`credits`, `credits_monthly`,
`credits_topup`, `credits_rollover`, `credits_daily`, `credits_grant`), each with
its own expiry, so the device can show e.g. "Monthly 382 · resets in 8mo".

### The durable runner: a Claude Code routine
A routine in **Claude Code on your always-on machine** is the right home — the
Lovable connector stays authorized there and the schedule survives (unlike a
Claude **web** session, whose container is ephemeral). Set it up once:

```cron
# every 6h at :13, run the skill headless
13 */6 * * * cd /path/to/sidekickdashboard && claude -p "/lovable-sync" >> ~/sidekick-lovable.log 2>&1
```

(or a long-lived Claude Code session with CronCreate `"13 */6 * * *"`, `durable: true`).
It still needs the dashboard deployed so `DASHBOARD_URL` / `INGEST_TOKEN` exist.

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
