import { NextRequest, NextResponse } from 'next/server';
import { buildDashboard, fetchLatest } from '@/lib/aggregate';
import { isReadAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics/<key>?key=<DASHBOARD_READ_TOKEN>
 * Returns a single flat value, e.g. /api/metrics/claude_session_pct -> { "value": 42 }.
 * Useful for SenseCraft widgets that bind to a top-level "value" field.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!isReadAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const rows = await fetchLatest();
    const flat = buildDashboard(rows).flat;
    const value = params.key in flat ? flat[params.key] : null;
    return NextResponse.json(
      { key: params.key, value },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
