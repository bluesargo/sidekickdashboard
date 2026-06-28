# Collector setup

The collector runs on the machine where your AI coding CLIs are logged in. It
reads local usage and pushes snapshots to your deployed dashboard.

## Install & run

```bash
cd collector
npm install
cp .env.example .env
```

Edit `.env`:

| Var | Required | Notes |
|-----|----------|-------|
| `DASHBOARD_URL` | ✅ | e.g. `https://your-app.vercel.app` |
| `INGEST_TOKEN` | ✅ | must match the server's `INGEST_TOKEN` |
| `POLL_SECONDS` | | default `300` (5 min) |
| `CLAUDE_DIR` | | default `~/.claude` |
| `CLAUDE_SESSION_CAP_USD` | | cost cap → session `%` gauge |
| `CLAUDE_WEEKLY_CAP_USD` | | cost cap → weekly `%` gauge |
| `CODEX_DIR` | | default `~/.codex` |
| `CURSOR_API_KEY` | | enables Cursor usage fetch |
| `LOVABLE_CREDITS` | | optional manual push |
| `REPLIT_BALANCE_USD` | | optional manual push |

Then:

```bash
npm run once     # single collect + push (use to verify)
npm start        # poll forever every POLL_SECONDS
```

## Keeping it running

**macOS/Linux (launchd/systemd or tmux):** simplest is a `systemd --user` service
or a `tmux` session running `npm start`. For cron-style, run `npm run once` on a
schedule.

Example crontab (every 5 minutes):
```cron
*/5 * * * * cd /path/to/sidekickdashboard/collector && /usr/bin/env npm run once >> /tmp/sidekick.log 2>&1
```

## What each provider reads

- **Claude** — walks `~/.claude/projects/**/*.jsonl`, sums token cost over a
  rolling 5h (session) and 7d (weekly) window. With caps set, reports a `%`;
  always reports USD spend.
- **Codex** — best-effort walk of `~/.codex` for token-usage-shaped JSON over 7d.
- **Cursor** — if `CURSOR_API_KEY` is set, fetches usage from the Cursor API.
  Adjust the endpoint/field mapping in `src/providers/cursor.ts` to your plan.
- **Lovable / Replit** — pushed from env if set, else entered via `/admin`.

## Adding a provider

1. Create `src/providers/<name>.ts` exporting a `ProviderModule`
   (`{ name, async collect(): Promise<Metric[]> }`).
2. Return `Metric[]` — never throw; catch internally and return `[]`.
3. Register it in the `PROVIDERS` array in `src/index.ts`.
