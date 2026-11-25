import { useQuery } from '@tanstack/react-query'
import { api, unwrap, type Device } from '../api/client'
import { RUNS_LIMIT, useRuns } from '../live/runs'
import { failureReasons, frequentDevices, successRates, verifiedShare, type Ranked } from './stats'

// FR-12, C-07: every run in plain language, and simple stats computed from the same list. The
// spec has no stats route yet, so the stats cover the newest RUNS_LIMIT runs and say so
// (docs/proposed-api.md: GET /stats would let the hub count every run).

export function HistoryPage() {
  const runs = useRuns()
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })

  if (runs.isPending) return <p>Loading…</p>
  if (runs.isError) return <p className="error">Could not load runs: {runs.error.message}</p>

  const names = new Map((devices.data ?? []).map((d: Device) => [d.device_id, d.name]))
  const rates = successRates(runs.data)
  const verified = mappings.data ? verifiedShare(mappings.data) : null

  return (
    <section>
      <div className="stat-row">
        <Stat label="Wireless success" value={pct(rates.wireless)} />
        <Stat label="Press success" value={pct(rates.arm)} />
        <Stat label="Mappings verified" value={pct(verified)} />
        <Stat label="Runs" value={String(runs.data.length)} />
      </div>
      <p className="muted small" aria-label="Stats scope">
        {runs.data.length >= RUNS_LIMIT ? `From the newest ${RUNS_LIMIT} runs.` : `From all ${runs.data.length} runs so far.`}
      </p>
      <div className="rank-row">
        <RankList title="Why runs did not succeed" items={failureReasons(runs.data)} empty="Every run succeeded." />
        <RankList
          title="Most used devices"
          items={frequentDevices(runs.data).map((r) => ({ ...r, key: names.get(r.key) ?? r.key }))}
          empty="No runs yet."
        />
      </div>
      <h2>Runs</h2>
      <ul className="runs">
        {runs.data.map((r) => (
          <li key={r.run_id} id={`run-${r.run_id}`} className={`run ${r.result}`}>
            <span className="badge">{r.result}</span>
            <span className="when">{new Date(r.started_at).toLocaleString()}</span>
            <span className="what">
              {r.explanation ?? r.intent ?? r.run_id}
              {r.resolution?.choice === 'leave' && <span className="badge">you left it</span>}
              {r.resolution?.choice === 'retry' && (
                <a className="badge" href={`#run-${r.resolution.retry_run_id}`}>you tried again</a>
              )}
              {r.retry_of && <a className="badge" href={`#run-${r.retry_of}`}>a new try of an earlier run</a>}
            </span>
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

function RankList({ title, items, empty }: { title: string; items: Ranked[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="rank" aria-label={title}>
      <h2>{title}</h2>
      {items.length === 0 && <p className="muted">{empty}</p>}
      <ol>
        {items.slice(0, 5).map((i) => (
          <li key={i.key}>
            <span className="rank-key">{i.key}</span>
            <span className="rank-bar" style={{ width: `${(i.count / max) * 100}%` }} />
            <span className="rank-count">{i.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
