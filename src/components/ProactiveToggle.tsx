import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { proposed } from '../api/extra'

// FR-06, C-06: the resident can pause proactive features from any screen.
// The state comes from GET /proactive (PROPOSED). Without it, the screen shows "unknown" until
// the resident saves one with PUT /proactive.

export function ProactiveToggle() {
  const qc = useQueryClient()
  const current = useQuery({ queryKey: ['proactive'], queryFn: proposed.proactive, retry: false })
  const save = useMutation({
    mutationFn: (paused: boolean) => unwrap(api.PUT('/proactive', { body: { paused } })),
    onSuccess: (data) => qc.setQueryData(['proactive'], data),
  })
  const paused = current.data?.paused ?? null

  return (
    <div className="proactive">
      <span className="proactive-label">
        Automation: {paused === null ? 'unknown' : paused ? 'paused' : 'on'}
      </span>
      <button type="button" disabled={save.isPending || paused === true} onClick={() => save.mutate(true)}>
        Pause
      </button>
      <button type="button" disabled={save.isPending || paused === false} onClick={() => save.mutate(false)}>
        Resume
      </button>
    </div>
  )
}
