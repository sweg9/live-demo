import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { proposed } from '../api/extra'

// FR-06, C-06: the resident can pause proactive features from any screen.
// Shows the state, and only the action that changes it. The state comes from GET /proactive
// (PROPOSED); while it is unknown, both actions are offered.

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
        <span className={`status-dot ${paused === null ? '' : paused ? 'unsure' : 'success'}`} aria-hidden="true" />
        Automation: {paused === null ? 'unknown' : paused ? 'paused' : 'on'}
      </span>
      {paused !== true && (
        <button type="button" disabled={save.isPending} onClick={() => save.mutate(true)}>
          Pause
        </button>
      )}
      {paused !== false && (
        <button type="button" disabled={save.isPending} onClick={() => save.mutate(false)}>
          Resume
        </button>
      )}
    </div>
  )
}
