import { config } from '../config.js';
import type { Metric, ProviderModule } from '../types.js';

// ---------------------------------------------------------------------------
// Cursor's real usage source is the Admin API (team plans). It uses HTTP Basic
// auth with the API key as the username (empty password). POST /teams/spend
// returns current-cycle spend per member.
// Generate a key at: cursor.com/dashboard -> Settings -> Cursor Admin API Keys.
// Ref: https://cursor.com/docs/account/teams/admin-api
//
// Individual (non-team) plans have no public usage API — enter a balance in
// /admin instead. If CURSOR_API_KEY is unset, this provider is a no-op.
// ---------------------------------------------------------------------------
interface MemberSpend {
  email?: string;
  name?: string;
  spendCents?: number;
  fastPremiumRequests?: number;
  hardLimitOverrideDollars?: number;
  role?: string;
}
interface SpendResponse {
  teamMemberSpend?: MemberSpend[];
  subscriptionCycleStart?: number;
  totalMembers?: number;
}

function basicAuth(key: string): string {
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

export const cursor: ProviderModule = {
  name: 'cursor',
  async collect(): Promise<Metric[]> {
    if (!config.cursorApiKey) return [];

    let data: SpendResponse;
    try {
      const res = await fetch(`${config.cursorApiBase}/teams/spend`, {
        method: 'POST',
        headers: { authorization: basicAuth(config.cursorApiKey), 'content-type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        console.warn(`[cursor] /teams/spend ${res.status}; skipping`);
        return [];
      }
      data = (await res.json()) as SpendResponse;
    } catch (err) {
      console.warn(`[cursor] ${err instanceof Error ? err.message : 'fetch failed'}`);
      return [];
    }

    const members = data.teamMemberSpend ?? [];
    // Scope to one member if CURSOR_EMAIL is set, else aggregate the team.
    const scoped = config.cursorEmail
      ? members.filter((m) => m.email?.toLowerCase() === config.cursorEmail!.toLowerCase())
      : members;
    if (scoped.length === 0) return [];

    const spendCents = scoped.reduce((sum, m) => sum + (m.spendCents ?? 0), 0);
    const fastRequests = scoped.reduce((sum, m) => sum + (m.fastPremiumRequests ?? 0), 0);
    const usedUsd = Math.round(spendCents) / 100;

    // Remaining = limit - spend, where the limit is a per-member hard limit (single
    // member) or the configured CURSOR_LIMIT_USD.
    const memberLimit =
      scoped.length === 1 && typeof scoped[0].hardLimitOverrideDollars === 'number'
        ? scoped[0].hardLimitOverrideDollars
        : undefined;
    const limit = config.cursorLimitUsd ?? memberLimit;

    const metrics: Metric[] = [
      {
        provider: 'cursor',
        metric: 'used_usd',
        value: usedUsd,
        unit: 'usd',
        label: 'Cursor spend',
        detail: { source: 'admin-api', fast_premium_requests: fastRequests, members: scoped.length }
      }
    ];

    if (typeof limit === 'number' && limit > 0) {
      metrics.push({
        provider: 'cursor',
        metric: 'balance_usd',
        value: Math.round((limit - usedUsd) * 100) / 100,
        unit: 'usd',
        label: 'Cursor remaining',
        detail: { source: 'admin-api', limit_usd: limit }
      });
      metrics.push({
        provider: 'cursor',
        metric: 'used_pct',
        value: Math.min(100, Math.round((usedUsd / limit) * 1000) / 10),
        unit: 'pct',
        label: 'Cursor used'
      });
    }
    return metrics;
  }
};
