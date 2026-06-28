import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { Metric, ProviderModule } from '../types.js';

// Codex CLI logs sessions locally (e.g. ~/.codex/sessions/*.jsonl). The exact
// schema varies by version, so this is best-effort: we walk JSONL and sum any
// token-usage-shaped fields we recognize over the last 7 days. There is no local
// "balance" signal — set it via /admin or CODEX balance override if you want one.
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let items: import('node:fs').Dirent[];
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...(await walk(full)));
    else if (it.isFile() && (it.name.endsWith('.jsonl') || it.name.endsWith('.json')))
      out.push(full);
  }
  return out;
}

function extractUsage(obj: any): { tokens: number; ts: number } | null {
  const u = obj?.usage ?? obj?.token_usage ?? obj?.message?.usage;
  if (!u) return null;
  const tokens =
    (u.total_tokens ?? 0) ||
    (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0);
  const ts = Date.parse(obj?.timestamp ?? obj?.created_at ?? obj?.ts ?? '');
  return { tokens, ts: Number.isNaN(ts) ? Date.now() : ts };
}

export const codex: ProviderModule = {
  name: 'codex',
  async collect(): Promise<Metric[]> {
    const files = await walk(config.codexDir);
    if (files.length === 0) return [];

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let weekTokens = 0;
    for (const file of files) {
      let text: string;
      try {
        text = await fs.readFile(file, 'utf8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        let obj: any;
        try {
          obj = JSON.parse(t);
        } catch {
          continue;
        }
        const u = extractUsage(obj);
        if (u && u.ts >= weekAgo) weekTokens += u.tokens;
      }
    }

    if (weekTokens === 0) return [];
    return [
      {
        provider: 'codex',
        metric: 'weekly_tokens',
        value: weekTokens,
        unit: 'tokens',
        label: 'Codex tokens (7d)',
        detail: { window_days: 7, source: 'local-logs' }
      }
    ];
  }
};
