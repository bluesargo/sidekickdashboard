import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { costUsd, totalTokens, type Usage } from '../pricing.js';
import type { Metric, ProviderModule } from '../types.js';

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
  const projectsDir = path.join(config.claudeDir, 'projects');
  const files = await walkJsonl(projectsDir);
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

      // Dedup identical assistant messages that appear in multiple transcripts.
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

export const claude: ProviderModule = {
  name: 'claude',
  async collect(): Promise<Metric[]> {
    const entries = await readEntries();
    if (entries.length === 0) return [];

    const now = Date.now();
    const session = sumSince(entries, now - 5 * 60 * 60 * 1000); // rolling 5h
    const weekly = sumSince(entries, now - 7 * 24 * 60 * 60 * 1000); // rolling 7d

    const sessionResets = new Date(now + 5 * 60 * 60 * 1000).toISOString();
    const weeklyResets = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

    return [
      {
        provider: 'claude',
        metric: 'session_pct',
        value: pct(session.cost, config.claudeSessionCapUsd),
        unit: 'pct',
        label: 'Session',
        detail: {
          cost_usd: round(session.cost),
          tokens: session.tokens,
          window_hours: 5,
          cap_usd: config.claudeSessionCapUsd ?? null,
          resets_at: sessionResets
        }
      },
      {
        provider: 'claude',
        metric: 'weekly_pct',
        value: pct(weekly.cost, config.claudeWeeklyCapUsd),
        unit: 'pct',
        label: 'Weekly',
        detail: {
          cost_usd: round(weekly.cost),
          tokens: weekly.tokens,
          window_days: 7,
          cap_usd: config.claudeWeeklyCapUsd ?? null,
          resets_at: weeklyResets
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
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
