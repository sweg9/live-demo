import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// POST /logout ends the session for good (spec). Every cached record leaves the screen with it.
export function SignOut() {
  const qc = useQueryClient()
  const out = useMutation({
    mutationFn: () => api.POST('/logout'),
    onSettled: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      qc.setQueryData(['me'], null)
    },
  })
  return (
    <button type="button" className="quiet" disabled={out.isPending} onClick={() => out.mutate()}>
      Sign out
    </button>
  )
}
