import { useState } from 'react'
import { api } from '../api/client'

// FR-06, C-06: the resident can pause proactive features from any screen.
// The API has PUT /proactive only (no GET), so the state shown is the last one the server confirmed.

export function ProactiveToggle() {
  const [paused, setPaused] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  async function set(next: boolean) {
    setBusy(true)
    const { data, response } = await api.PUT('/proactive', { body: { paused: next } })
    if (response.ok && data) setPaused(data.paused)
    setBusy(false)
  }

  return (
    <div className="proactive">
      <span className="proactive-label">
        Automation: {paused === null ? '—' : paused ? 'paused' : 'on'}
      </span>
      <button type="button" disabled={busy || paused === true} onClick={() => set(true)}>
        Pause
      </button>
      <button type="button" disabled={busy || paused === false} onClick={() => set(false)}>
        Resume
      </button>
    </div>
  )
}
