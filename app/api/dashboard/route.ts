import { NextRequest, NextResponse } from 'next/server';
import { buildDashboard, fetchLatest } from '@/lib/aggregate';
import { isReadAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard?key=<DASHBOARD_READ_TOKEN>
 * The single endpoint SenseCraft HMI binds to. Returns a flat + nested JSON of
 * the latest usage values for every provider.
 */
export async function GET(req: NextRequest) {
  if (!isReadAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const rows = await fetchLatest();
    const json = buildDashboard(rows);
    return NextResponse.json(json, {
      headers: { 'cache-control': 'no-store' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
