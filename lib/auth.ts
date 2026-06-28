import { NextRequest } from 'next/server';

/** Extract a bearer token from the Authorization header. */
function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Collector → POST /api/ingest. Authorized via INGEST_TOKEN. */
export function isIngestAuthorized(req: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false;
  return bearer(req) === expected;
}

/** /admin manual entry. Authorized via ADMIN_TOKEN (X-Admin-Token header). */
export function isAdminAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  return req.headers.get('x-admin-token') === expected;
}

/**
 * Device (SenseCraft HMI) → GET dashboard JSON. SenseCraft can send a custom
 * header or we accept a ?key= query param. Authorized via DASHBOARD_READ_TOKEN.
 * If no token is configured, reads are open (handy for first-run/testing).
 */
export function isReadAuthorized(req: NextRequest): boolean {
  const expected = process.env.DASHBOARD_READ_TOKEN;
  if (!expected) return true;
  const fromHeader = req.headers.get('x-api-key');
  const fromQuery = req.nextUrl.searchParams.get('key');
  return fromHeader === expected || fromQuery === expected;
}
