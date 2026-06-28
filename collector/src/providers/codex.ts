import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { Metric, ProviderModule } from '../types.js';

// ---------------------------------------------------------------------------
// Codex persists a rate-limit snapshot in its session rollout JSONL files
// (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl). `token_count` events carry a
// `rate_limits` object with primary (rolling 5h) and secondary (weekly) windows,
// each with used_percent / window_minutes / resets_in_seconds. This is exactly
// what `/status` shows — read locally, no auth required.
// Ref: openai/codex issues #14728, #15281, #23190.
// ---------------------------------------------------------------------------
interface RateWindow {
  used_percent?: number;
  window_minutes?: number;
  resets_in_seconds?: number;
  resets_at?: string;
}
interface RateLimits {
  primary?: RateWindow;
  secondary?: RateWindow;
  plan_type?: string;
}

interface FileInfo {
  file: string;
  mtime: number;
}

async function walk(dir: string): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  let items: import('node:fs').Dirent[];
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...(await walk(full)));
    else if (it.isFile() && full.endsWith('.jsonl')) {
      try {
        const stat = await fs.stat(full);
        out.push({ file: full, mtime: stat.mtimeMs });
      } catch {
        // ignore unreadable file
      }
    }
  }
  return out;
}

/** Depth-first search for the first `rate_limits` object anywhere in a value. */
function findRateLimits(value: unknown): RateLimits | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (obj.rate_limits && typeof obj.rate_limits === 'object') {
    return obj.rate_limits as RateLimits;
  }
  for (const v of Object.values(obj)) {
    const found = findRateLimits(v);
    if (found) return found;
  }
  return null;
}

/** Scan a rollout file and return the LAST rate_limits snapshot it contains. */
async function latestSnapshotIn(file: string): Promise<RateLimits | null> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  let latest: RateLimits | null = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || !t.includes('rate_limits')) continue;
    try {
      const found = findRateLimits(JSON.parse(t));
      if (found) latest = found;
    } catch {
      // skip malformed line
    }
  }
  return latest;
}

function windowMetric(
  w: RateWindow | undefined,
  metric: string,
  label: string
): Metric | null {
  if (!w || typeof w.used_percent !== 'number') return null;
  const resets_at =
    w.resets_at ??
    (typeof w.resets_in_seconds === 'number'
      ? new Date(Date.now() + w.resets_in_seconds * 1000).toISOString()
      : null);
  return {
    provider: 'codex',
    metric,
    value: Math.round(w.used_percent * 10) / 10,
    unit: 'pct',
    label,
    detail: { source: 'rollout', window_minutes: w.window_minutes ?? null, resets_at }
  };
}

export const codex: ProviderModule = {
  name: 'codex',
  async collect(): Promise<Metric[]> {
    const sessionsDir = path.join(config.codexDir, 'sessions');
    const files = (await walk(sessionsDir)).sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return [];

    // Walk newest-first until we find a file containing a snapshot.
    for (const { file } of files.slice(0, 10)) {
      const snap = await latestSnapshotIn(file);
      if (!snap) continue;
      const metrics = [
        windowMetric(snap.primary, 'session_pct', 'Session'),
        windowMetric(snap.secondary, 'weekly_pct', 'Weekly')
      ].filter((m): m is Metric => m !== null);
      if (metrics.length) return metrics;
    }
    return [];
  }
};
