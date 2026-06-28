import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthorized } from '@/lib/auth';
import { buildDashboard, fetchLatest } from '@/lib/aggregate';
import { writeMetrics } from '@/lib/ingest';
import { IngestPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET current values for the admin UI to prefill. */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const rows = await fetchLatest();
    return NextResponse.json(buildDashboard(rows));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST manual overrides (e.g. Lovable / Replit balances). */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let payload: IngestPayload;
  try {
    payload = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    const written = await writeMetrics({ ...payload, source: 'manual' });
    return NextResponse.json({ ok: true, written });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
