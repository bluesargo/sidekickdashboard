#!/usr/bin/env -S npx tsx
import { assertConfig, config } from './config.js';
import { push } from './push.js';
import type { Metric, ProviderModule } from './types.js';
import { claude } from './providers/claude.js';
import { codex } from './providers/codex.js';
import { cursor } from './providers/cursor.js';
import { manual } from './providers/manual.js';

const PROVIDERS: ProviderModule[] = [claude, codex, cursor, manual];

async function collectOnce(): Promise<Metric[]> {
  const all: Metric[] = [];
  for (const p of PROVIDERS) {
    try {
      const metrics = await p.collect();
      console.log(`[collect] ${p.name}: ${metrics.length} metric(s)`);
      all.push(...metrics);
    } catch (err) {
      console.warn(`[collect] ${p.name} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return all;
}

async function runCycle(): Promise<void> {
  const metrics = await collectOnce();
  await push(metrics);
}

async function main(): Promise<void> {
  assertConfig();
  const once = process.argv.includes('--once');

  await runCycle().catch((err) => console.error('[cycle] error:', err));
  if (once) return;

  console.log(`[collector] polling every ${config.pollSeconds}s. Ctrl-C to stop.`);
  setInterval(() => {
    runCycle().catch((err) => console.error('[cycle] error:', err));
  }, config.pollSeconds * 1000);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
