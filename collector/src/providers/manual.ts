import { config } from '../config.js';
import type { Metric, ProviderModule } from '../types.js';

// Lovable and Replit have no clean public usage API. You can either enter these
// in the /admin page (recommended) or set LOVABLE_CREDITS / REPLIT_BALANCE_USD
// in the collector env to push them every cycle.
export const manual: ProviderModule = {
  name: 'lovable', // nominal; emits across providers
  async collect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    if (typeof config.lovableCredits === 'number') {
      metrics.push({
        provider: 'lovable',
        metric: 'credits',
        value: config.lovableCredits,
        unit: 'credits',
        label: 'Lovable credits',
        detail: { source: 'env' }
      });
    }
    if (typeof config.replitBalanceUsd === 'number') {
      metrics.push({
        provider: 'replit',
        metric: 'balance_usd',
        value: config.replitBalanceUsd,
        unit: 'usd',
        label: 'Replit balance',
        detail: { source: 'env' }
      });
    }
    return metrics;
  }
};
