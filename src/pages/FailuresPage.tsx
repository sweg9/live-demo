import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import { proposed } from '../api/extra'
import type { RunWithResolution } from '../api/proposed'
import { useDevices } from '../api/hooks'

// C-09: a failed, unsure or cancelled run waits for the resident: Try again or Leave it.
// The system never presses again on its own. A run leaves this list once the resident chose.

const OPEN: RunWithResolution['result'][] = ['failure', 'unsure', 'cancelled']

export function FailuresPage() {
  const qc = useQueryClient()
  const devices = useDevices()
  const runs = useQuery({
    queryKey: ['runs'],
    queryFn: () => unwrap(api.GET('/runs', { params: { query: { limit: 100 } } })) as Promise<RunWithResolution[]>,
  })
  const [notice, setNotice] = useState<{ runId: string; text: string; ok: boolean } | null>(null)

  const choose = useMutation({
    mutationFn: ({ runId, verb }: { runId: string; verb: 'retry' | 'leave' }): Promise<unknown> =>
      verb === 'retry' ? proposed.retry(runId) : proposed.leave(runId),
    onSuccess: (_d, { runId, verb }) =>
      setNotice({ runId, ok: true, text: verb === 'retry' ? 'Trying again.' : 'Left as it is. It stays in History.' }),
    onError: (e, { runId }) => setNotice({ runId, ok: false, text: e instanceof ApiError ? e.message : 'It could not be sent.' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  })

  if (runs.isPending) return <p>Loading…</p>
  if (runs.isError) return <p className="error">Could not load runs: {runs.error.message}</p>

  const open = runs.data.filter((r) => OPEN.includes(r.result) && !r.resolution)

  return (
    <section>
      <h1>Failures</h1>
      <p className="muted">Nothing here is tried again on its own. Choose for each one.</p>
      {notice?.ok && (
        <p role="status" className="ok">
          {notice.text} {notice.text.startsWith('Trying') && <Link to="/">Follow it on Now</Link>}
        </p>
      )}
      {open.length === 0 && <p className="muted">Nothing is waiting for you.</p>}
      <ul className="runs">
        {open.map((r) => (
          <li key={r.run_id} className={`run ${r.result}`}>
            <span className="badge">{r.result}</span>
            <span className="when">
              {devices.name(r.device_id)}
              <br />
              {new Date(r.started_at).toLocaleString()}
            </span>
            <span className="what">
              {r.explanation ?? r.intent}
              <span className="meta"> · {[r.channel, r.reason].filter(Boolean).join(' · ')}</span>
              {notice && !notice.ok && notice.runId === r.run_id && (
                <span role="alert" className="error block">{notice.text}</span>
              )}
            </span>
            <span className="actions">
              <button disabled={choose.isPending} onClick={() => choose.mutate({ runId: r.run_id, verb: 'retry' })}>
                Try again
              </button>
              <button disabled={choose.isPending} onClick={() => choose.mutate({ runId: r.run_id, verb: 'leave' })}>
                Leave it
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
