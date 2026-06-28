-- Sidekick Dashboard schema
-- One row per (provider, metric) observation. We keep history and read the latest per key.

create table if not exists public.usage_snapshots (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,                 -- claude | codex | cursor | lovable | replit
  metric        text not null,                 -- session_pct | weekly_pct | credits | balance_usd | ...
  value         numeric,                       -- numeric value (nullable for text-only metrics)
  unit          text,                          -- pct | credits | usd | tokens | count
  label         text,                          -- human label shown on the dashboard
  detail        jsonb not null default '{}'::jsonb,  -- resets_at, raw counts, source, etc.
  source        text not null default 'collector',  -- collector | manual | api
  captured_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists usage_snapshots_provider_metric_idx
  on public.usage_snapshots (provider, metric, captured_at desc);

-- Latest value for each (provider, metric).
create or replace view public.latest_usage as
select distinct on (provider, metric)
  provider, metric, value, unit, label, detail, source, captured_at
from public.usage_snapshots
order by provider, metric, captured_at desc;

-- RLS: lock the table down. All reads/writes go through the Next.js API using the
-- service-role key (which bypasses RLS). The anon key can do nothing directly.
alter table public.usage_snapshots enable row level security;
