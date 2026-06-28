export type Provider = 'claude' | 'codex' | 'cursor' | 'lovable' | 'replit';
export type Unit = 'pct' | 'credits' | 'usd' | 'tokens' | 'count';

export interface Metric {
  provider: Provider;
  metric: string;
  value: number | null;
  unit?: Unit;
  label?: string;
  detail?: Record<string, unknown>;
}

export interface ProviderModule {
  name: Provider;
  collect(): Promise<Metric[]>;
}
