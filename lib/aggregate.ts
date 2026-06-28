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

/** Build the dashboard JSON consumed by the device + the web preview. */
export function buildDashboard(rows: LatestRow[]): DashboardJson {
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

    bucket[r.metric] = r.value;
    if (r.label) bucket[`${r.metric}_label`] = r.label;
    if (r.unit) bucket[`${r.metric}_unit`] = r.unit;
    if (r.detail && Object.keys(r.detail).length) bucket[`${r.metric}_detail`] = r.detail;

    out.flat[`${r.provider}_${r.metric}`] = r.value;

    const t = Date.parse(r.captured_at);
    if (!Number.isNaN(t) && t > latest) latest = t;
  }

  out.updated_at = latest ? new Date(latest).toISOString() : null;
  return out;
}
