---
name: lovable-sync
description: Read Lovable workspace credits and push them to the Sidekick Dashboard ingest endpoint. Use when asked to sync/refresh Lovable credits, or on a schedule (e.g. every 6 hours).
---

# Lovable credit sync

## What the connector can and can't give you
`mcp__Lovable__get_workspace` returns only:
- `billing_period_credits_limit` — the monthly grant size (e.g. 400)
- `billing_period_credits_used` — cumulative usage this billing period (does NOT
  reconcile to spendable balance)
- `next_monthly_credit_grant_date` — when monthly credits reset to the grant size
  (leftover monthly → rollover at that moment)
- `topup_credits_purchased_at` — top-up purchase date (top-ups expire ~1y later)

It does NOT expose the spendable **ledger** the Lovable UI shows (monthly /
top-up / rollover / daily build credits / total). So the exact balance can't come
from the connector alone — see "Getting exact balances" below.

## Credit model (what the dashboard tracks)
Push these metrics (omit any you don't have a value for):

| metric | meaning | reset/expiry (`detail.resets_at`) |
|---|---|---|
| `credits` | total spendable (headline) | next monthly grant |
| `credits_monthly` | monthly bucket remaining | monthly expiry date |
| `credits_topup` | top-up bucket remaining | top-up expiry date |
| `credits_rollover` | rollover bucket | — |
| `credits_daily` | daily build credits (used first) | next 00:00 UTC |
| `credits_grant` | monthly grant size (from connector) | next monthly grant |

## Steps
1. `mcp__Lovable__get_workspace` (id `EibbhbC0hdDjMvBZs6go` for Blue Sargo) →
   read `billing_period_credits_limit` (grant) and `next_monthly_credit_grant_date`.
2. Get the exact spendable buckets (see below).
3. Push (env `DASHBOARD_URL`, `INGEST_TOKEN`):
   ```bash
   node scripts/push-metrics.mjs '[
     {"provider":"lovable","metric":"credits","value":413,"unit":"credits","label":"Lovable credits","detail":{"resets_at":"2026-07-14T08:00:00Z"}},
     {"provider":"lovable","metric":"credits_monthly","value":382,"unit":"credits","label":"Monthly","detail":{"resets_at":"2027-03-14T00:00:00Z"}},
     {"provider":"lovable","metric":"credits_topup","value":31.4,"unit":"credits","label":"Top-up","detail":{"resets_at":"2027-06-10T00:00:00Z"}},
     {"provider":"lovable","metric":"credits_rollover","value":0,"unit":"credits","label":"Rollover"},
     {"provider":"lovable","metric":"credits_daily","value":5,"unit":"credits","label":"Daily","detail":{"resets_at":"<next-midnight-UTC>"}},
     {"provider":"lovable","metric":"credits_grant","value":400,"unit":"credits","label":"Monthly grant","detail":{"resets_at":"2026-07-14T08:00:00Z"}}
   ]'
   ```
4. Report the pushed total + next reset.

## Getting exact balances (pick one; configured per setup)
- **Manual/slow** — the monthly/top-up/rollover buckets only change at known reset
  dates, so set them once via `/admin`; the routine still refreshes `credits_grant`
  and the reset countdowns automatically.
- **Browser read** — drive a logged-in Lovable session (Playwright) to read the
  Credit balance dialog and push exact buckets. Exact but more brittle.

## Scheduling (Claude Code routine)
Run this from a persistent Claude Code install where the Lovable connector is
configured (e.g. your always-on dev box) — that's the durable runner. Either:
- OS cron: `13 */6 * * * cd /path/to/sidekickdashboard && claude -p "/lovable-sync" >> ~/sidekick-lovable.log 2>&1`
- or a long-lived Claude Code session with CronCreate `"13 */6 * * *"` (`durable: true`).
