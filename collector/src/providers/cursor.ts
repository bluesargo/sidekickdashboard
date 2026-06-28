import { config } from '../config.js';
import type { Metric, ProviderModule } from '../types.js';

// Cursor exposes usage via its dashboard/admin API. If you have an API key, set
// CURSOR_API_KEY and this will try to fetch it. Endpoints/fields differ between
// individual and team plans, so we parse defensively and fall back to nothing
// (use /admin for a manual override). Adjust the URL/shape to match your account.
const CURSOR_USAGE_URL = 'https://api.cursor.com/usage';

export const cursor: ProviderModule = {
  name: 'cursor',
  async collect(): Promise<Metric[]> {
    if (!config.cursorApiKey) return [];

    try {
      const res = await fetch(CURSOR_USAGE_URL, {
        headers: { authorization: `Bearer ${config.cursorApiKey}` }
      });
      if (!res.ok) {
        console.warn(`[cursor] usage fetch ${res.status}; skipping`);
        return [];
      }
      const data: any = await res.json();

      // Best-effort field extraction across plausible shapes.
      const remaining =
        data?.balance_usd ?? data?.remaining_usd ?? data?.usage?.remaining ?? null;
      const used = data?.used_usd ?? data?.usage?.used ?? null;

      const metrics: Metric[] = [];
      if (typeof remaining === 'number') {
        metrics.push({
          provider: 'cursor',
          metric: 'balance_usd',
          value: remaining,
          unit: 'usd',
          label: 'Cursor balance',
          detail: { source: 'api' }
        });
      }
      if (typeof used === 'number') {
        metrics.push({
          provider: 'cursor',
          metric: 'used_usd',
          value: used,
          unit: 'usd',
          label: 'Cursor used'
        });
      }
      return metrics;
    } catch (err) {
      console.warn(`[cursor] ${err instanceof Error ? err.message : 'fetch failed'}`);
      return [];
    }
  }
};
