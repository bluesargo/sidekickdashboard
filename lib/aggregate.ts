import { getSupabase } from './supabase';
import { LatestRow, Provider } from './types';

export interface DashboardJson {
  updated_at: string | null;
  // Nested per-provider view (handy for humans / structured binding).
  claude: Record<string, unknown>;
  codex: Record<string, unknown>;
  cursor: Record<string, unknown>;
  lovable: Record<string, unknown>;
  replit: Record<string, unknown>;
  // Flat single-level keys — the easiest thing to bind a SenseCraft HMI widget to,
  // e.g. path "flat.claude_session_pct".
  flat: Record<string, number | string | null>;
}

export async function fetchLatest(): Promise<LatestRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('latest_usage')
    .select('provider, metric, value, unit, label, detail, source, captured_at');
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data ?? []) as LatestRow[];
}

/** "in 3h 12m" / "in 4d" / "now" — for a future reset timestamp. */
function relativeFuture(iso: string, now: number): string {
  let ms = Date.parse(iso) - now;
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86_400_000);
  ms -= d * 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

/** "5m ago" / "2h ago" / "just now" — for a past capture timestamp. */
function relativePast(iso: string, now: number): string {
  let ms = now - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  if (ms < 60_000) return 'just now';
  const d = Math.floor(ms / 86_400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ago`;
}

/**
 * Build the dashboard JSON consumed by the device + the web preview. For every
 * metric we surface, in addition to the value:
 *  - `<key>_updated_at` / `<key>_updated_ago`  — when the value was captured
 *  - `<key>_resets_at`  / `<key>_resets_in`    — when the limit window resets
 *    (only when the metric carries a reset time in its detail)
 * Relative strings are computed at request time, so they're correct on each
 * device poll.
 */
export function buildDashboard(rows: LatestRow[], nowMs?: number): DashboardJson {
  const now = nowMs ?? Date.now();
  const out: DashboardJson = {
    updated_at: null,
    claude: {},
    codex: {},
    cursor: {},
    lovable: {},
    replit: {},
    flat: {}
  };

  let latest = 0;
  for (const r of rows) {
    const bucket = out[r.provider as Provider] as Record<string, unknown> | undefined;
    if (!bucket) continue;

    const base = `${r.provider}_${r.metric}`;
    bucket[r.metric] = r.value;
    out.flat[base] = r.value;

    if (r.label) bucket[`${r.metric}_label`] = r.label;
    if (r.unit) bucket[`${r.metric}_unit`] = r.unit;
    if (r.detail && Object.keys(r.detail).length) bucket[`${r.metric}_detail`] = r.detail;

    // Freshness: when this value was captured.
    if (r.captured_at) {
      const ago = relativePast(r.captured_at, now);
      bucket[`${r.metric}_updated_at`] = r.captured_at;
      bucket[`${r.metric}_updated_ago`] = ago;
      out.flat[`${base}_updated_at`] = r.captured_at;
      out.flat[`${base}_updated_ago`] = ago;
    }

    // Expiration: when this limit's window resets (if the metric carries one).
    const resetsAt = r.detail?.resets_at;
    if (typeof resetsAt === 'string' && resetsAt) {
      const rin = relativeFuture(resetsAt, now);
      bucket[`${r.metric}_resets_at`] = resetsAt;
      bucket[`${r.metric}_resets_in`] = rin;
      out.flat[`${base}_resets_at`] = resetsAt;
      out.flat[`${base}_resets_in`] = rin;
    }

    const t = Date.parse(r.captured_at);
    if (!Number.isNaN(t) && t > latest) latest = t;
  }

  out.updated_at = latest ? new Date(latest).toISOString() : null;
  if (out.updated_at) {
    out.flat.updated_at = out.updated_at;
    out.flat.updated_ago = relativePast(out.updated_at, now);
  }
  return out;
}
