import { useQuery } from '@tanstack/react-query'
import { api, unwrap, type Device, type Run } from '../api/client'

// FR-12, C-07: every run in plain language, and simple stats computed from the same list.

export function HistoryPage() {
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => unwrap(api.GET('/runs', { params: { query: { limit: 100 } } })) })
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })

  if (runs.isPending) return <p>Loading…</p>
  if (runs.isError) return <p className="error">Could not load runs: {runs.error.message}</p>

  const names = new Map((devices.data ?? []).map((d: Device) => [d.device_id, d.name]))
  const s = stats(runs.data)

  return (
    <section>
      <h1>History & stats</h1>
      <div className="stat-row">
        <Stat label="Wireless success" value={pct(s.wireless)} />
        <Stat label="Press success" value={pct(s.arm)} />
        <Stat label="Runs" value={String(runs.data.length)} />
      </div>
      <ul className="runs">
        {runs.data.map((r) => (
          <li key={r.run_id} className={`run ${r.result}`}>
            <span className="badge">{r.result}</span>
            <span className="when">{new Date(r.started_at).toLocaleString()}</span>
            <span className="what">{r.explanation ?? r.intent ?? r.run_id}</span>
            <span className="meta">
              {r.device_id ? names.get(r.device_id) ?? r.device_id : ''} {r.channel ? `· ${r.channel}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

// Cancelled runs never tried the channel, so they are left out of the success rates.
export function stats(runs: Run[]) {
  const rate = (rs: Run[]) => {
    const tried = rs.filter((r) => r.result !== 'cancelled')
    return tried.length ? tried.filter((r) => r.result === 'success').length / tried.length : null
  }
  return {
    wireless: rate(runs.filter((r) => r.channel && r.channel !== 'ARM')),
    arm: rate(runs.filter((r) => r.channel === 'ARM')),
  }
}
