import { useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { LoginPage } from '../pages/LoginPage'

// The app calls GET /me on start: 200 shows the dashboard, 401 the sign-in screen (spec: /me).
// Any later 401 (the session ended) brings the sign-in screen back.

export function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, response } = await api.GET('/me')
      if (response.status === 401) return null // signed out: not an error
      if (!response.ok) throw new ApiError(response.status, undefined)
      return data!
    },
    retry: false,
  })

  useEffect(
    () =>
      qc.getQueryCache().subscribe((e) => {
        const err = e.query.state.error
        if (e.type === 'updated' && err instanceof ApiError && err.status === 401 && e.query.queryKey[0] !== 'me') {
          qc.invalidateQueries({ queryKey: ['me'] })
        }
      }),
    [qc],
  )

  if (me.isPending) return <p className="center muted">Loading…</p>
  if (me.isError) {
    return (
      <div className="center">
        <p className="error">The home cannot be reached right now{me.error instanceof ApiError ? ` (HTTP ${me.error.status})` : ''}.</p>
        <p className="muted">The stop key on the hub and the robot's power switch work without the app.</p>
        <button type="button" onClick={() => me.refetch()}>Try again</button>
      </div>
    )
  }
  if (me.data === null) return <LoginPage />
  return <>{children}</>
}
