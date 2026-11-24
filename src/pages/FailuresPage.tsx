import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'

// C-09: a failed or unsure run waits for the resident. The system never presses again on its own.

export function FailuresPage() {
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => unwrap(api.GET('/runs', { params: { query: { limit: 100 } } })) })

  if (runs.isPending) return <p>Loading…</p>
  if (runs.isError) return <p className="error">Could not load runs: {runs.error.message}</p>

  const open = runs.data.filter((r) => r.result === 'failure' || r.result === 'unsure' || r.result === 'cancelled')

  return (
    <section>
      <h1>Failures</h1>
      {open.length === 0 && <p className="muted">Nothing failed.</p>}
      <ul className="runs">
        {open.map((r) => (
          <li key={r.run_id} className={`run ${r.result}`}>
            <span className="badge">{r.result}</span>
            <span className="when">{new Date(r.started_at).toLocaleString()}</span>
            <span className="what">
              {r.explanation ?? r.intent}
              <span className="meta"> · {[r.channel, r.reason].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="actions">
              <button disabled title="No API route yet">Try again</button>
              <button disabled title="No API route yet">Leave it</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted">Try again and Leave it need an API route; until then they are disabled.</p>
    </section>
  )
}
