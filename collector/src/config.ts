import os from 'node:os';
import path from 'node:path';

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export const config = {
  dashboardUrl: process.env.DASHBOARD_URL?.replace(/\/$/, '') ?? '',
  ingestToken: process.env.INGEST_TOKEN ?? '',
  pollSeconds: num(process.env.POLL_SECONDS) ?? 300,

  claudeDir: process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude'),
  claudeSessionCapUsd: num(process.env.CLAUDE_SESSION_CAP_USD),
  claudeWeeklyCapUsd: num(process.env.CLAUDE_WEEKLY_CAP_USD),

  codexDir: process.env.CODEX_DIR || path.join(os.homedir(), '.codex'),

  cursorApiKey: process.env.CURSOR_API_KEY || '',

  lovableCredits: num(process.env.LOVABLE_CREDITS),
  replitBalanceUsd: num(process.env.REPLIT_BALANCE_USD)
};

export function assertConfig(): void {
  if (!config.dashboardUrl) throw new Error('DASHBOARD_URL is required');
  if (!config.ingestToken) throw new Error('INGEST_TOKEN is required');
}
