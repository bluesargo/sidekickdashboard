import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { costUsd, totalTokens, type Usage } from '../pricing.js';
import type { Metric, ProviderModule } from '../types.js';

// ---------------------------------------------------------------------------
// Primary source: real rate-limit utilization from Anthropic.
//
// Claude Code stores an OAuth token in ~/.claude/.credentials.json. A minimal
// request to /v1/messages comes back with the *actual* unified rate-limit
// headers — the same session/weekly numbers Claude Code shows in /status.
// We read the headers regardless of the response status, so even an error
// response still yields the utilization (no need to consume a real completion).
// Ref: hamed-elfayome/Claude-Usage-Tracker (ClaudeAPIService.swift).
// ---------------------------------------------------------------------------
async function readOAuthToken(): Promise<string | null> {
  if (process.env.CLAUDE_OAUTH_TOKEN) return process.env.CLAUDE_OAUTH_TOKEN;
  for (const name of ['.credentials.json', 'credentials.json']) {
    try {
      const raw = await fs.readFile(path.join(config.claudeDir, name), 'utf8');
      const json = JSON.parse(raw);
      const token = json?.claudeAiOauth?.accessToken;
      if (typeof token === 'string' && token) return token;
    } catch {
      // try next location
    }
  }
  return null;
}

function pctFromHeader(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  // Headers are a 0.0–1.0 fraction; surface as a 0–100 %.
  return Math.round(n * 1000) / 10;
}

function resetIso(v: string | null): string | null {
  if (!v) return null;
  const secs = Number(v);
  if (Number.isNaN(secs)) return null;
  return new Date(secs * 1000).toISOString();
}

async function collectFromOAuth(): Promise<Metric[] | null> {
  const token = await readOAuthToken();
  if (!token) return null;

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        // OAuth-token requests must identify as Claude Code.
        system: "You are Claude Code, Anthropic's official CLI for Claude.",
        messages: [{ role: 'user', content: '.' }]
      })
    });
  } catch (err) {
    console.warn(`[claude] oauth request failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }

  const h = res.headers;
  const session = pctFromHeader(h.get('anthropic-ratelimit-unified-5h-utilization'));
  const weekly = pctFromHeader(h.get('anthropic-ratelimit-unified-7d-utilization'));
  if (session === null && weekly === null) {
    // No rate-limit headers (e.g. token expired / API-key account). Fall back.
    return null;
  }

  const sessionReset = resetIso(h.get('anthropic-ratelimit-unified-5h-reset'));
  const weeklyReset = resetIso(h.get('anthropic-ratelimit-unified-7d-reset'));
  const opus = pctFromHeader(h.get('anthropic-ratelimit-unified-7d-opus-utilization'));

  const metrics: Metric[] = [
    {
      provider: 'claude',
      metric: 'session_pct',
      value: session,
      unit: 'pct',
      label: 'Session',
      detail: { source: 'oauth-headers', window_hours: 5, resets_at: sessionReset }
    },
    {
      provider: 'claude',
      metric: 'weekly_pct',
      value: weekly,
      unit: 'pct',
      label: 'Weekly',
      detail: { source: 'oauth-headers', window_days: 7, resets_at: weeklyReset }
    }
  ];
  if (opus !== null) {
    metrics.push({
      provider: 'claude',
      metric: 'weekly_opus_pct',
      value: opus,
      unit: 'pct',
      label: 'Weekly (Opus)',
      detail: { source: 'oauth-headers' }
    });
  }
  return metrics;
}

// ---------------------------------------------------------------------------
// Fallback source: estimate spend from local JSONL transcripts.
// Used when no OAuth token is available (e.g. API-key auth). Turns rolling cost
// into a % only if caps are configured; otherwise reports USD spend.
// ---------------------------------------------------------------------------
interface Entry {
  ts: number;
  cost: number;
  tokens: number;
}

async function walkJsonl(dir: string): Promise<string[]> {
  const out: string[] = [];
  let items: import('node:fs').Dirent[];
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...(await walkJsonl(full)));
    else if (it.isFile() && it.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

async function readEntries(): Promise<Entry[]> {
  const files = await walkJsonl(path.join(config.claudeDir, 'projects'));
  const entries: Entry[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    let text: string;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj: any;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const usage: Usage | undefined = obj?.message?.usage;
      if (!usage) continue;

      const dedupKey = `${obj?.message?.id ?? ''}:${obj?.requestId ?? ''}`;
      if (dedupKey !== ':' && seen.has(dedupKey)) continue;
      if (dedupKey !== ':') seen.add(dedupKey);

      const ts = Date.parse(obj?.timestamp ?? '');
      if (Number.isNaN(ts)) continue;

      const cost =
        typeof obj?.costUSD === 'number' ? obj.costUSD : costUsd(usage, obj?.message?.model);
      entries.push({ ts, cost, tokens: totalTokens(usage) });
    }
  }
  return entries;
}

function sumSince(entries: Entry[], sinceMs: number) {
  let cost = 0;
  let tokens = 0;
  const now = Date.now();
  for (const e of entries) {
    if (e.ts >= sinceMs && e.ts <= now) {
      cost += e.cost;
      tokens += e.tokens;
    }
  }
  return { cost, tokens };
}

function pct(cost: number, cap: number | undefined): number | null {
  if (!cap || cap <= 0) return null;
  return Math.min(100, Math.round((cost / cap) * 1000) / 10);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

async function collectFromJsonl(): Promise<Metric[]> {
  const entries = await readEntries();
  if (entries.length === 0) return [];

  const now = Date.now();
  const session = sumSince(entries, now - 5 * 60 * 60 * 1000);
  const weekly = sumSince(entries, now - 7 * 24 * 60 * 60 * 1000);

  return [
    {
      provider: 'claude',
      metric: 'session_pct',
      value: pct(session.cost, config.claudeSessionCapUsd),
      unit: 'pct',
      label: 'Session',
      detail: {
        source: 'jsonl-estimate',
        cost_usd: round(session.cost),
        tokens: session.tokens,
        window_hours: 5,
        cap_usd: config.claudeSessionCapUsd ?? null
      }
    },
    {
      provider: 'claude',
      metric: 'weekly_pct',
      value: pct(weekly.cost, config.claudeWeeklyCapUsd),
      unit: 'pct',
      label: 'Weekly',
      detail: {
        source: 'jsonl-estimate',
        cost_usd: round(weekly.cost),
        tokens: weekly.tokens,
        window_days: 7,
        cap_usd: config.claudeWeeklyCapUsd ?? null
      }
    },
    {
      provider: 'claude',
      metric: 'session_cost_usd',
      value: round(session.cost),
      unit: 'usd',
      label: 'Session spend'
    },
    {
      provider: 'claude',
      metric: 'weekly_cost_usd',
      value: round(weekly.cost),
      unit: 'usd',
      label: 'Weekly spend'
    }
  ];
}

export const claude: ProviderModule = {
  name: 'claude',
  async collect(): Promise<Metric[]> {
    // Prefer the real rate-limit headers; fall back to local-spend estimate.
    const oauth = await collectFromOAuth();
    if (oauth) {
      // Enrich with spend figures from JSONL when available (best effort).
      const spend = (await collectFromJsonl()).filter((m) => m.metric.endsWith('cost_usd'));
      return [...oauth, ...spend];
    }
    return collectFromJsonl();
  }
};
