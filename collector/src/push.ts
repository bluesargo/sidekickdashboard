import { config } from './config.js';
import type { Metric } from './types.js';

/** POST a batch of metrics to the dashboard ingest endpoint. */
export async function push(metrics: Metric[]): Promise<void> {
  if (metrics.length === 0) {
    console.log('[push] no metrics to send');
    return;
  }
  const res = await fetch(`${config.dashboardUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ingestToken}`
    },
    body: JSON.stringify({ source: 'collector', metrics })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ingest failed: ${res.status} ${res.statusText} ${body}`);
  }
  const json = (await res.json().catch(() => ({}))) as { written?: number };
  console.log(`[push] sent ${metrics.length} metric(s); server wrote ${json.written ?? '?'}`);
}
