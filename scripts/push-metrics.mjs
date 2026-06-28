#!/usr/bin/env node
// Push one or more metrics to the dashboard ingest endpoint.
//
// Used by the connector sync (Lovable/Replit via MCP) and handy for scripting.
// Reads DASHBOARD_URL and INGEST_TOKEN from env.
//
// Usage:
//   DASHBOARD_URL=https://app.vercel.app INGEST_TOKEN=xxx \
//     node scripts/push-metrics.mjs '[{"provider":"lovable","metric":"credits","value":120,"unit":"credits","label":"Lovable credits"}]'
//
//   # or pipe JSON on stdin:
//   echo '[...]' | node scripts/push-metrics.mjs
//
// The JSON may be either a metrics array or a full {source?, metrics:[...]} payload.

const url = process.env.DASHBOARD_URL?.replace(/\/$/, '');
const token = process.env.INGEST_TOKEN;
if (!url || !token) {
  console.error('DASHBOARD_URL and INGEST_TOKEN are required');
  process.exit(1);
}

async function readInput() {
  const arg = process.argv[2];
  if (arg) return arg;
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').trim();
}

const raw = await readInput();
if (!raw) {
  console.error('No metrics provided (pass JSON as an argument or on stdin)');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}

const payload = Array.isArray(parsed)
  ? { source: 'connector', metrics: parsed }
  : { source: parsed.source ?? 'connector', metrics: parsed.metrics };

const res = await fetch(`${url}/api/ingest`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(payload)
});

const body = await res.text();
if (!res.ok) {
  console.error(`ingest failed: ${res.status} ${res.statusText} ${body}`);
  process.exit(1);
}
console.log(`pushed ${payload.metrics.length} metric(s): ${body}`);
