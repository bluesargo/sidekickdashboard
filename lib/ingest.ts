import { getSupabase } from './supabase';
import { IngestPayload, Metric, PROVIDERS } from './types';

function isValidMetric(m: unknown): m is Metric {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  if (!PROVIDERS.includes(r.provider as never)) return false;
  if (typeof r.metric !== 'string' || !r.metric) return false;
  if (r.value !== null && typeof r.value !== 'number') return false;
  return true;
}

/** Validate + insert a batch of metrics. Returns the number of rows written. */
export async function writeMetrics(payload: IngestPayload): Promise<number> {
  if (!payload || !Array.isArray(payload.metrics)) {
    throw new Error('payload.metrics must be an array');
  }
  const valid = payload.metrics.filter(isValidMetric);
  if (valid.length === 0) return 0;

  const source = payload.source ?? 'collector';
  const capturedAt = payload.capturedAt ?? new Date().toISOString();

  const rows = valid.map((m) => ({
    provider: m.provider,
    metric: m.metric,
    value: m.value,
    unit: m.unit ?? null,
    label: m.label ?? null,
    detail: m.detail ?? {},
    source,
    captured_at: capturedAt
  }));

  const supabase = getSupabase();
  const { error } = await supabase.from('usage_snapshots').insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return rows.length;
}
