import { buildDashboard, fetchLatest, type DashboardJson } from '@/lib/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Card {
  name: string;
  big: string;
  meta?: string;
  pct?: number | null;
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
  const c = d.claude as Record<string, number | undefined>;
  return [
    {
      name: 'Claude · Session',
      big: pctBig(c.session_pct),
      meta: c.session_resets_at ? `resets ${String(c.session_resets_at)}` : 'current 5h window',
      pct: typeof c.session_pct === 'number' ? c.session_pct : null
    },
    {
      name: 'Claude · Weekly',
      big: pctBig(c.weekly_pct),
      meta: 'weekly limit',
      pct: typeof c.weekly_pct === 'number' ? c.weekly_pct : null
    },
    {
      name: 'Lovable · Credits',
      big: num((d.lovable as Record<string, unknown>).credits),
      meta: 'credit balance'
    },
    {
      name: 'Codex · Session',
      big: pctBig((d.codex as Record<string, unknown>).session_pct),
      meta:
        typeof (d.codex as Record<string, unknown>).weekly_pct === 'number'
          ? `weekly ${pctBig((d.codex as Record<string, unknown>).weekly_pct)}`
          : 'rolling 5h',
      pct:
        typeof (d.codex as Record<string, unknown>).session_pct === 'number'
          ? ((d.codex as Record<string, unknown>).session_pct as number)
          : null
    },
    {
      name: 'Cursor · Balance',
      big: usd((d.cursor as Record<string, unknown>).balance_usd),
      meta: 'remaining'
    },
    {
      name: 'Replit · Balance',
      big: usd((d.replit as Record<string, unknown>).balance_usd),
      meta: 'remaining'
    }
  ];
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
        {dashboard?.updated_at ? `Updated ${dashboard.updated_at}.` : 'No data yet.'}
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
            toCards(dashboard).map((card) => (
              <div className="card" key={card.name}>
                <p className="name">{card.name}</p>
                <div className="big">{card.big}</div>
                {card.meta && <div className="meta">{card.meta}</div>}
                {typeof card.pct === 'number' && (
                  <div className="bar">
                    <span style={{ width: `${Math.min(100, Math.max(0, card.pct))}%` }} />
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <p className="note">
        Device endpoint: <code>/api/dashboard?key=…</code> · Manual entry: <code>/admin</code>
      </p>
    </main>
  );
}
