import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type ApiErrorBody } from '../api/client'

// Sign-in with the resident's password (spec: POST /login). The hub checks it and the server
// sets an HttpOnly cookie, so the app never stores the password or a token (C-10).
// Other sign-in methods (for example Kakao or Naver) would add a button below the form; see
// docs/proposed-api.md, "To decide as a team".

const MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK !== 'off'
// The mock's demo password (mocks/hub.ts DEMO_PASSWORD). Not a real credential: the real one is
// set on the hub as APP_PASSWORD_HASH and never appears in a repo (C-10).
const MOCK_PASSWORD = 'nova-demo'

const MESSAGES: Record<number, string> = {
  401: 'Wrong password.',
  429: 'Too many wrong passwords. Try again in a minute.',
  503: 'The hub at home is offline, so nobody can sign in now.',
}

export function LoginPage() {
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: async (pw: string) => {
      const { error, response } = await api.POST('/login', { body: { password: pw } })
      if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined)
    },
    onSuccess: () => {
      setPassword('')
      qc.invalidateQueries()
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password) login.mutate(password)
  }
  const err = login.error instanceof ApiError ? MESSAGES[login.error.status] ?? login.error.message : login.error ? 'Sign-in failed.' : null

  return (
    <main className="login">
      <form onSubmit={submit} className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">NOVA</h1>
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {err && <p role="alert" className="error">{err}</p>}
        <button type="submit" className="primary" disabled={!password || login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        {MOCK && <p className="muted small">Demo mock: the password is <code>{MOCK_PASSWORD}</code>.</p>}
      </form>
      <p className="muted small login-note">
        Without signing in, the stop key on the hub and the robot's power switch still stop the robot.
      </p>
    </main>
  )
}
