import { buildDashboard, fetchLatest, type DashboardJson } from '@/lib/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Card {
  name: string;
  big: string;
  meta?: string;
  pct?: number | null;
  srcKey: string; // flat key used to look up resets/updated times
}

function pctBig(v: unknown): string {
  return typeof v === 'number' ? `${Math.round(v)}%` : '—';
}
function num(v: unknown): string {
  return typeof v === 'number' ? String(v) : '—';
}
function usd(v: unknown): string {
  return typeof v === 'number' ? `$${v.toFixed(2)}` : '—';
}

function toCards(d: DashboardJson): Card[] {
  const c = d.codex as Record<string, unknown>;
  const cur = d.cursor as Record<string, unknown>;
  const hasCursorBalance = typeof cur.balance_usd === 'number';
  return [
    {
      name: 'Claude · Session',
      big: pctBig((d.claude as Record<string, unknown>).session_pct),
      meta: 'rolling 5h',
      pct: typeof (d.claude as Record<string, unknown>).session_pct === 'number'
        ? ((d.claude as Record<string, unknown>).session_pct as number)
        : null,
      srcKey: 'claude_session_pct'
    },
    {
      name: 'Claude · Weekly',
      big: pctBig((d.claude as Record<string, unknown>).weekly_pct),
      meta: 'weekly limit',
      pct: typeof (d.claude as Record<string, unknown>).weekly_pct === 'number'
        ? ((d.claude as Record<string, unknown>).weekly_pct as number)
        : null,
      srcKey: 'claude_weekly_pct'
    },
    {
      name: 'Lovable · Credits',
      big: num((d.lovable as Record<string, unknown>).credits),
      meta: 'credits left',
      srcKey: 'lovable_credits'
    },
    {
      name: 'Codex · Session',
      big: pctBig(c.session_pct),
      meta: typeof c.weekly_pct === 'number' ? `weekly ${pctBig(c.weekly_pct)}` : 'rolling 5h',
      pct: typeof c.session_pct === 'number' ? (c.session_pct as number) : null,
      srcKey: 'codex_session_pct'
    },
    {
      name: 'Cursor · Balance',
      big: hasCursorBalance ? usd(cur.balance_usd) : usd(cur.used_usd),
      meta: hasCursorBalance ? 'remaining' : 'spend this cycle',
      srcKey: hasCursorBalance ? 'cursor_balance_usd' : 'cursor_used_usd'
    },
    {
      name: 'Replit · Balance',
      big: usd((d.replit as Record<string, unknown>).balance_usd),
      meta: 'remaining',
      srcKey: 'replit_balance_usd'
    }
  ];
}

function subline(d: DashboardJson, srcKey: string): string {
  const resets = d.flat[`${srcKey}_resets_in`];
  const updated = d.flat[`${srcKey}_updated_ago`];
  return [
    typeof resets === 'string' && resets ? `resets ${resets}` : '',
    typeof updated === 'string' && updated ? `updated ${updated}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

export default async function Home() {
  let dashboard: DashboardJson | null = null;
  let error: string | null = null;
  try {
    dashboard = buildDashboard(await fetchLatest());
  } catch (e) {
    error = e instanceof Error ? e.message : 'unknown error';
  }

  return (
    <main className="wrap">
      <h1>Sidekick Dashboard</h1>
      <p className="sub">
        Live preview of what your reTerminal renders.{' '}
        {dashboard?.updated_at
          ? `Updated ${dashboard.flat.updated_ago ?? dashboard.updated_at}.`
          : 'No data yet.'}
      </p>

      {error ? (
        <div className="card">
          <p className="name">Not configured</p>
          <div className="meta">{error}</div>
          <p className="note">
            Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>, apply the
            migration in <code>supabase/migrations</code>, then run the collector.
          </p>
        </div>
      ) : (
        <div className="grid">
          {dashboard &&
            toCards(dashboard).map((card) => {
              const sub = subline(dashboard!, card.srcKey);
              return (
                <div className="card" key={card.name}>
                  <p className="name">{card.name}</p>
                  <div className="big">{card.big}</div>
                  {card.meta && <div className="meta">{card.meta}</div>}
                  {typeof card.pct === 'number' && (
                    <div className="bar">
                      <span style={{ width: `${Math.min(100, Math.max(0, card.pct))}%` }} />
                    </div>
                  )}
                  {sub && <div className="meta">{sub}</div>}
                </div>
              );
            })}
        </div>
      )}

      <p className="note">
        Device endpoint: <code>/api/dashboard?key=…</code> · Manual entry: <code>/admin</code>
      </p>
    </main>
  );
}
