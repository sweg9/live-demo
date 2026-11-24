import { useState } from 'react'
import { api, ApiError } from '../api/client'

// FR-10, C-04: always on screen, one press, no confirmation dialog in the way.
// The server answers 200 {ral}, 503 hub_offline, or 504 stop_not_confirmed. In both failures the
// resident is told to use the key on the hub or the power switch, which work without the app.

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'stopped' }
  | { kind: 'failed'; message: string }

export const FALLBACK = 'Use the stop key on the hub or switch off the robot power.'

export function EmergencyStop() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function stop() {
    setStatus({ kind: 'sending' })
    try {
      const { data, error, response } = await api.POST('/stop')
      if (!response.ok) throw new ApiError(response.status, error as never)
      const ral = (data as { ral?: string } | undefined)?.ral
      setStatus(ral === 'error' ? { kind: 'failed', message: `The robot reported an error. ${FALLBACK}` } : { kind: 'stopped' })
    } catch (e) {
      const msg = e instanceof ApiError && e.body?.message ? e.body.message : 'The stop could not be sent.'
      setStatus({ kind: 'failed', message: `${msg} ${FALLBACK}` })
    }
  }

  return (
    <div className="estop">
      <button type="button" className="estop-button" onClick={stop} disabled={status.kind === 'sending'}>
        {status.kind === 'sending' ? 'Stopping…' : 'Emergency stop'}
      </button>
      <span role="status" aria-live="assertive" className={`estop-status ${status.kind}`}>
        {status.kind === 'stopped' && 'Robot stopped.'}
        {status.kind === 'failed' && status.message}
      </span>
    </div>
  )
}
