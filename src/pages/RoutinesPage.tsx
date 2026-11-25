import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, unwrap, type Routine, type Schemas } from '../api/client'
import { useDevices } from '../api/hooks'

// C-06, FR-04, FR-06: the resident keeps, changes or removes each routine, and chooses how
// independently it acts. Nothing here runs a device: it only changes the routine on the hub.

type Feedback = Schemas['RoutineFeedback']
type Independence = Routine['independence']

const INDEPENDENCE: Record<Independence, string> = {
  act_and_tell: 'Do it, then tell me',
  ask_first: 'Ask me first',
  suggest_only: 'Only suggest',
}

export function RoutinesPage() {
  const qc = useQueryClient()
  const devices = useDevices()
  const routines = useQuery({ queryKey: ['routines'], queryFn: () => unwrap(api.GET('/routines')) })
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  const [notice, setNotice] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const send = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Feedback }) =>
      unwrap(api.POST('/routines/{routine_id}/feedback', { params: { path: { routine_id: id } }, body })),
    onSuccess: (_d, { id, body }) =>
      setNotice({ id, ok: true, text: { keep: 'Kept as it is.', change: 'Changed.', remove: 'Removed. It will not run again.' }[body.decision] }),
    onError: (e, { id }) => setNotice({ id, ok: false, text: e instanceof ApiError ? e.message : 'It could not be sent.' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })

  if (routines.isPending) return <p>Loading…</p>
  if (routines.isError) return <p className="error">Could not load routines: {routines.error.message}</p>

  const deviceOf = new Map((mappings.data ?? []).map((m) => [m.mapping_id, m.device_id ?? undefined]))
  const risk = (deviceId?: string) => (deviceId ? devices.byId.get(deviceId)?.risk : undefined)

  return (
    <section>
      <p className="muted">Routines the hub learned from your habits or you made. Keep, change or remove each one, and choose how much it may do alone.</p>
      {notice?.ok && <p role="status" className="ok">{notice.text}</p>}
      {routines.data.length === 0 && <p className="muted">No routines yet.</p>}
      <ul className="runs routines">
        {routines.data.map((r) => {
          const device = deviceOf.get(r.mapping_id)
          return (
            <RoutineRow
              key={r.routine_id}
              routine={r}
              name={devices.name(device)}
              high={risk(device) === 'high'}
              busy={send.isPending}
              error={notice && !notice.ok && notice.id === r.routine_id ? notice.text : null}
              onSend={(body) => send.mutate({ id: r.routine_id, body })}
            />
          )
        })}
      </ul>
    </section>
  )
}

function RoutineRow(props: {
  routine: Routine
  name: string
  high: boolean
  busy: boolean
  error: string | null
  onSend: (body: Feedback) => void
}) {
  const { routine: r, name, high, busy, error, onSend } = props
  const [time, setTime] = useState(r.time ?? '')
  const [independence, setIndependence] = useState<Independence>(r.independence)
  const changed = time !== (r.time ?? '') || independence !== r.independence

  return (
    <li className="run" aria-label={`Routine: ${name}`}>
      <span className="badge">{r.source === 'habit' ? 'learned' : 'yours'}</span>
      <span className="when">
        {name}
        <br />
        turn {r.action}
        {high && <span className="badge high">high risk</span>}
      </span>
      <span className="what">
        <label>
          Time <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>{' '}
        <label>
          It may{' '}
          <select value={independence} onChange={(e) => setIndependence(e.target.value as Independence)}>
            {(Object.keys(INDEPENDENCE) as Independence[]).map((k) => (
              <option key={k} value={k}>{INDEPENDENCE[k]}</option>
            ))}
          </select>
        </label>
        {high && <span className="meta"> · A high-risk device is never turned on without asking you (C-03).</span>}
        {error && <span role="alert" className="error block">{error}</span>}
      </span>
      <span className="actions">
        {changed ? (
          <button disabled={busy} onClick={() => onSend({ decision: 'change', time: time || undefined, independence })}>Save change</button>
        ) : (
          <button disabled={busy} onClick={() => onSend({ decision: 'keep' })}>Keep</button>
        )}
        <button disabled={busy} onClick={() => window.confirm(`Remove the routine for ${name}?`) && onSend({ decision: 'remove' })}>
          Remove
        </button>
      </span>
    </li>
  )
}
