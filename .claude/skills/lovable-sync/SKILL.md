---
name: lovable-sync
description: Read Lovable workspace credit balance via the Lovable MCP connector and push it to the Sidekick Dashboard ingest endpoint. Use when asked to sync/refresh Lovable credits, or on a schedule (e.g. every 6 hours).
---

# Lovable credit sync

Lovable has no public credits REST API — the balance is only reachable through the
**Lovable MCP connector**, which lives in the Claude environment. This skill reads
it and pushes to the dashboard's `POST /api/ingest`.

## Prerequisites
- The Lovable connector is available (`mcp__Lovable__*` tools).
- Env vars set: `DASHBOARD_URL`, `INGEST_TOKEN` (the deployed app + its ingest token).
- `LOVABLE_WORKSPACE_ID` set (or known). For Blue Sargo it is `EibbhbC0hdDjMvBZs6go`.

## Steps
1. Call `mcp__Lovable__get_workspace` with the workspace id (use
   `mcp__Lovable__list_workspaces` first if the id is unknown).
2. Map the response fields:
   - `used`      = `billing_period_credits_used`
   - `limit`     = `billing_period_credits_limit`
   - `remaining` = `max(0, round(limit - used))`
   - `usage_pct` = `round(used / limit * 100)`
   - `resets_at` = `next_monthly_credit_grant_date`  ← the credit reset/expiration
   - `plan`      = `plan`
3. Push via the helper (or an equivalent `fetch` to `${DASHBOARD_URL}/api/ingest`
   with `Authorization: Bearer ${INGEST_TOKEN}`):

   ```bash
   node scripts/push-metrics.mjs '[
     {"provider":"lovable","metric":"credits","value":<remaining>,"unit":"credits","label":"Lovable credits","detail":{"resets_at":"<resets_at>","used":<used>,"limit":<limit>,"plan":"<plan>"}},
     {"provider":"lovable","metric":"usage_pct","value":<usage_pct>,"unit":"pct","label":"Lovable used","detail":{"resets_at":"<resets_at>"}},
     {"provider":"lovable","metric":"credits_used","value":<used>,"unit":"credits","label":"Used"},
     {"provider":"lovable","metric":"credits_limit","value":<limit>,"unit":"credits","label":"Limit"}
   ]'
   ```
4. Report the pushed `remaining` and `resets_at`.

## Scheduling every 6 hours
Run this on a persistent Claude surface (e.g. Claude Code on your own machine,
where the connector is authorized and a durable cron can run). With CronCreate:
`cron: "13 */6 * * *"`, prompt: "Run the lovable-sync skill." Note recurring
CronCreate jobs auto-expire after 7 days and do not survive an ephemeral
(web) container being reclaimed.
