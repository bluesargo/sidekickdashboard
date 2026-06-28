export type Provider = 'claude' | 'codex' | 'cursor' | 'lovable' | 'replit';

export type Unit = 'pct' | 'credits' | 'usd' | 'tokens' | 'count';

/** A single observation pushed by the collector or entered manually. */
export interface Metric {
  provider: Provider;
  metric: string; // e.g. 'session_pct', 'weekly_pct', 'credits', 'balance_usd'
  value: number | null;
  unit?: Unit;
  label?: string;
  detail?: Record<string, unknown>; // resets_at, raw token counts, source notes, ...
}

export interface IngestPayload {
  source?: 'collector' | 'manual' | 'api' | 'connector';
  capturedAt?: string; // ISO; defaults to server now()
  metrics: Metric[];
}

/** Row shape returned by the latest_usage view. */
export interface LatestRow {
  provider: Provider;
  metric: string;
  value: number | null;
  unit: Unit | null;
  label: string | null;
  detail: Record<string, unknown> | null;
  source: string;
  captured_at: string;
}

export const PROVIDERS: Provider[] = ['claude', 'codex', 'cursor', 'lovable', 'replit'];
