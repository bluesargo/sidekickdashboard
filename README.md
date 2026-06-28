# Sidekick Dashboard

A remote **ePaper dashboard for your vibe-coding + business-ops stack**, built for the
[Seeed Studio reTerminal E1001](https://www.seeedstudio.com/reTerminal-E1001-p-6534.html)
(ESP32-S3, 7.5″ 800×480 monochrome ePaper, ~3-month battery) driven by
[SenseCraft HMI](https://sensecraft.seeed.cc/hmi).

It shows, at a glance:

- **Claude** — current session usage + weekly limit usage
- **Lovable** — credit balance
- **Codex** — usage balance
- **Cursor** — usage balance
- **Replit** — usage balance

## How it works

```
 dev machine                         Vercel (Next.js)            Supabase            reTerminal E1001
┌────────────────┐  POST /api/ingest ┌──────────────────┐  SQL ┌───────────┐  GET  ┌────────────────┐
│ collector      │ ─────────────────▶│ ingest route     │ ───▶ │ usage_    │ ◀───  │ SenseCraft HMI │
│ (reads CLI     │  Bearer token     │                  │      │ snapshots │       │ binds widgets  │
│  session logs) │                   │ /api/dashboard   │ ◀─── │ (history) │       │ to JSON fields │
└────────────────┘                   └──────────────────┘      └───────────┘       └────────────────┘
```

1. A small **collector** runs on your dev machine. It reads local CLI usage
   (Claude Code / Codex session JSONL), optional provider APIs (Cursor), and
   manual values (Lovable / Replit), then pushes a snapshot to the cloud.
2. A **Next.js app on Vercel** stores snapshots in **Supabase** and exposes a
   flat JSON endpoint.
3. **SenseCraft HMI** on the reTerminal binds widgets to that JSON and refreshes
   on a timer.

Why this split? Most of these tools (Lovable, Replit, Codex, and Claude
*subscription* limits) have **no clean public usage API** — the reliable signal
lives in local CLI session files or your account page. So the numbers are
gathered on your machine and relayed to a cloud endpoint the battery-powered
device can poll.

## Project layout

| Path | What |
|------|------|
| `app/` | Next.js App Router — API routes + web preview + `/admin` |
| `lib/` | Supabase client, aggregation, auth, ingest validation |
| `supabase/migrations/` | Database schema (`usage_snapshots` table + `latest_usage` view) |
| `collector/` | Standalone local agent (its own `package.json`) |
| `docs/` | Setup guides for SenseCraft and the collector |

## Quick start

### 1. Database (Supabase)
Create a project, then apply `supabase/migrations/0001_init.sql` (SQL editor or
`supabase db push`).

### 2. Web app (Vercel)
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```
Set the env vars from `.env.example` in Vercel and deploy. See **`.env.example`**
for the full list (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_TOKEN`,
`DASHBOARD_READ_TOKEN`, `ADMIN_TOKEN`).

### 3. Collector (your machine)
```bash
cd collector
npm install
cp .env.example .env         # set DASHBOARD_URL + INGEST_TOKEN
npm run once                 # one push, to verify
npm start                    # poll forever
```
See [`docs/collector-setup.md`](docs/collector-setup.md).

### 4. Device (reTerminal + SenseCraft)
Bind a SenseCraft HMI dashboard to `GET /api/dashboard?key=<DASHBOARD_READ_TOKEN>`
and deploy to the device. See [`docs/sensecraft-setup.md`](docs/sensecraft-setup.md).

## API

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/dashboard?key=…` | read token | Flat + nested JSON for SenseCraft |
| `GET /api/metrics/<key>?key=…` | read token | Single value, e.g. `claude_session_pct` |
| `POST /api/ingest` | `Bearer INGEST_TOKEN` | Collector pushes a snapshot |
| `GET/POST /api/manual` | `X-Admin-Token` | Admin UI reads/writes manual values |

Example `GET /api/dashboard` response (trimmed):
```json
{
  "updated_at": "2026-06-28T12:00:00.000Z",
  "claude": { "session_pct": 42, "weekly_pct": 67, "session_pct_label": "Session" },
  "lovable": { "credits": 120 },
  "flat": {
    "claude_session_pct": 42,
    "claude_weekly_pct": 67,
    "lovable_credits": 120,
    "codex_weekly_tokens": 184000,
    "cursor_balance_usd": 7.5,
    "replit_balance_usd": 8.5
  }
}
```

Bind SenseCraft widgets to the `flat.*` keys — they're single-level and easiest
to map.

## Notes on data accuracy

- **Claude session/weekly %** is computed from a rolling cost window over your
  local Claude Code JSONL (5h / 7d) divided by configurable caps
  (`CLAUDE_SESSION_CAP_USD`, `CLAUDE_WEEKLY_CAP_USD`). It approximates the gauge;
  if a cap is unset the `%` is `null` and spend in USD is still reported.
- **Codex** weekly token count is best-effort from local logs (schema varies).
- **Cursor** needs `CURSOR_API_KEY`; otherwise enter a balance in `/admin`.
- **Lovable / Replit** are manual (`/admin` or collector env).

These are honest limitations of the upstream tools, not of the dashboard — every
provider also accepts a manual override so the display is never blank.

## Sources
- [reTerminal E1001 product page](https://www.seeedstudio.com/reTerminal-E1001-p-6534.html)
- [reTerminal E series wiki](https://wiki.seeedstudio.com/reterminal_e10xx_main_page/)
- [SenseCraft HMI](https://sensecraft.seeed.cc/hmi)
- [ccusage (Claude Code local usage parsing)](https://ccusage.com/guide/)
