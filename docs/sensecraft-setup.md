# SenseCraft HMI setup (reTerminal E1001)

The reTerminal E1001 renders dashboards designed in
[SenseCraft HMI](https://sensecraft.seeed.cc/hmi), Seeed's no-code editor.
SenseCraft can pull live data from an HTTP API and bind it to widgets. We point
it at this app's `GET /api/dashboard` endpoint.

## 1. Flash / pair the device

Follow Seeed's [Getting Started](https://wiki.seeedstudio.com/getting_started_with_reterminal_e1001/)
to connect the reTerminal to Wi-Fi and pair it with SenseCraft HMI.

## 2. Add the data source

In the SenseCraft HMI editor, open **Data → add a custom/API data source**:

- **URL:** `https://your-app.vercel.app/api/dashboard?key=YOUR_DASHBOARD_READ_TOKEN`
  - The `?key=` value is the server's `DASHBOARD_READ_TOKEN`.
  - If your SenseCraft version supports request headers instead, you can send
    `X-Api-Key: YOUR_DASHBOARD_READ_TOKEN` and drop the query param.
- **Method:** GET
- **Refresh interval:** match your battery/refresh tradeoff (e.g. 15–30 min).
  ePaper refreshes are slow; frequent polling drains battery for little gain.

> If data doesn't appear, double-check the URL and that the key matches — an
> unauthorized request returns `401 {"error":"unauthorized"}`.

## 3. Bind widgets

The response is JSON with a flat block that's easiest to bind. Use these field
paths:

| Widget | JSON path | Type |
|--------|-----------|------|
| Claude session | `flat.claude_session_pct` | number (%) |
| Claude weekly | `flat.claude_weekly_pct` | number (%) |
| Lovable credits | `flat.lovable_credits` | number |
| Codex session | `flat.codex_session_pct` | number (%) |
| Codex weekly | `flat.codex_weekly_pct` | number (%) |
| Cursor balance | `flat.cursor_balance_usd` | number ($) |
| Replit balance | `flat.replit_balance_usd` | number ($) |

For richer labels/reset times, the nested objects are also present, e.g.
`claude.session_pct_label`, `claude.session_pct_detail.resets_at`,
`claude.session_cost_usd`.

### Single-value alternative
If a widget prefers a top-level `value`, bind it to a per-metric endpoint:

```
https://your-app.vercel.app/api/metrics/claude_session_pct?key=YOUR_DASHBOARD_READ_TOKEN
→ { "key": "claude_session_pct", "value": 42 }
```

## 4. Suggested layout (800×480, monochrome)

A clean 2×3 grid of stat tiles works well on the 7.5″ panel:

```
┌──────────────┬──────────────┬──────────────┐
│ CLAUDE       │ CLAUDE       │ LOVABLE      │
│ SESSION  42% │ WEEKLY   67% │ CREDITS  120 │
├──────────────┼──────────────┼──────────────┤
│ CODEX        │ CURSOR       │ REPLIT       │
│ SESSION  35% │ $7.50        │ $8.50        │
└──────────────┴──────────────┴──────────────┘
```

Use large numerals (monochrome ePaper favors high contrast, minimal chrome), and
add a small "updated" line bound to `updated_at`.

## 5. Deploy to device

Hit **Deploy** in SenseCraft HMI to push the design to the paired reTerminal.
The device will fetch `/api/dashboard` on the interval you set.
