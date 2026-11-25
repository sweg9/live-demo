import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { Icon } from './Icon'

// FR-10, C-04: always on screen, one press, no confirmation dialog in the way. In the top bar on
// a desktop; floating above the tab bar on a phone, within reach of the thumb.
// The server answers 200 {ral}, 503 hub_offline, or 504 stop_not_confirmed. In both failures the
// resident is told to use the key on the hub or the power switch, which work without the app.

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'stopped' }
  | { kind: 'failed'; message: string }

export const FALLBACK = 'Use the stop key on the hub or switch off the robot power.'
const STOPPED_SHOWN_MS = 6000 // the confirmation fades; a failure stays until dismissed

export function EmergencyStop() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    if (status.kind !== 'stopped') return
    const t = setTimeout(() => setStatus({ kind: 'idle' }), STOPPED_SHOWN_MS)
    return () => clearTimeout(t)
  }, [status])

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
      {/* A phone shows the short label so the floating button covers less; the name stays whole */}
      <button
        type="button"
        className="estop-button"
        onClick={stop}
        disabled={status.kind === 'sending'}
        aria-label={status.kind === 'sending' ? 'Stopping…' : 'Emergency stop'}
      >
        <Icon name="stop" size={18} />
        <span className="label-full">{status.kind === 'sending' ? 'Stopping…' : 'Emergency stop'}</span>
        <span className="label-short" aria-hidden="true">{status.kind === 'sending' ? '…' : 'Stop'}</span>
      </button>
      <div role="status" aria-live="assertive" className={`estop-status ${status.kind}`}>
        {status.kind === 'stopped' && 'Robot stopped.'}
        {status.kind === 'failed' && (
          <>
            {status.message}
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setStatus({ kind: 'idle' })}>
              <Icon name="close" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
