'use client';

import { useState } from 'react';
import type { Metric } from '@/lib/types';

interface Field {
  provider: Metric['provider'];
  metric: string;
  label: string;
  unit: Metric['unit'];
  placeholder: string;
}

// Manual fields for sources without a reliable local/API signal.
const FIELDS: Field[] = [
  { provider: 'lovable', metric: 'credits', label: 'Lovable credits', unit: 'credits', placeholder: 'e.g. 120' },
  { provider: 'replit', metric: 'balance_usd', label: 'Replit balance ($)', unit: 'usd', placeholder: 'e.g. 8.50' },
  { provider: 'cursor', metric: 'balance_usd', label: 'Cursor balance ($)', unit: 'usd', placeholder: 'optional override' },
  { provider: 'codex', metric: 'balance_usd', label: 'Codex balance ($)', unit: 'usd', placeholder: 'optional override' }
];

export default function Admin() {
  const [token, setToken] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>('');

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    setStatus('Saving…');
    const metrics: Metric[] = FIELDS.flatMap((f) => {
      const raw = values[`${f.provider}.${f.metric}`];
      if (raw === undefined || raw.trim() === '') return [];
      const value = Number(raw);
      if (Number.isNaN(value)) return [];
      return [{ provider: f.provider, metric: f.metric, value, unit: f.unit, label: f.label }];
    });

    if (metrics.length === 0) {
      setStatus('Nothing to save.');
      return;
    }

    const res = await fetch('/api/manual', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ source: 'manual', metrics })
    });
    if (res.ok) {
      const json = await res.json();
      setStatus(`Saved ${json.written} value(s).`);
    } else {
      setStatus(`Error: ${res.status} ${res.statusText}`);
    }
  }

  return (
    <main className="wrap">
      <h1>Manual entry</h1>
      <p className="sub">For balances without a public API (Lovable, Replit) or to override a value.</p>

      <div className="card">
        <div className="row">
          <label htmlFor="admintoken">Admin token</label>
          <input
            id="admintoken"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
          />
        </div>
        {FIELDS.map((f) => {
          const key = `${f.provider}.${f.metric}`;
          return (
            <div className="row" key={key}>
              <label htmlFor={key}>{f.label}</label>
              <input
                id={key}
                inputMode="decimal"
                value={values[key] ?? ''}
                onChange={(e) => setVal(key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          );
        })}
        <div className="row">
          <button onClick={save}>Save</button>
          <span className="meta">{status}</span>
        </div>
      </div>

      <p className="note">Values are timestamped; the dashboard always shows the newest per metric.</p>
    </main>
  );
}
