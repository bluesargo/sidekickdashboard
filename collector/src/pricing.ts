// Approximate Claude pricing in USD per 1M tokens. Used only when a JSONL line
// has no precomputed costUSD. Tune if Anthropic pricing changes — these feed a
// rough usage gauge, not an invoice.
interface Price {
  input: number;
  output: number;
  cacheWrite: number; // cache_creation_input_tokens
  cacheRead: number; // cache_read_input_tokens
}

const OPUS: Price = { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 };
const SONNET: Price = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
const HAIKU: Price = { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 };

function priceFor(model: string | undefined): Price {
  const m = (model ?? '').toLowerCase();
  if (m.includes('opus')) return OPUS;
  if (m.includes('haiku')) return HAIKU;
  return SONNET; // sensible default
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function costUsd(usage: Usage | undefined, model: string | undefined): number {
  if (!usage) return 0;
  const p = priceFor(model);
  const per = 1_000_000;
  return (
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    per
  );
}

export function totalTokens(usage: Usage | undefined): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}
