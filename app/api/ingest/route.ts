import { NextRequest, NextResponse } from 'next/server';
import { isIngestAuthorized } from '@/lib/auth';
import { writeMetrics } from '@/lib/ingest';
import { IngestPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest
 * Authorization: Bearer <INGEST_TOKEN>
 * Body: { source?, capturedAt?, metrics: Metric[] }
 * The local collector calls this on every poll.
 */
export async function POST(req: NextRequest) {
  if (!isIngestAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let payload: IngestPayload;
  try {
    payload = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    const written = await writeMetrics({ ...payload, source: payload.source ?? 'collector' });
    return NextResponse.json({ ok: true, written });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
