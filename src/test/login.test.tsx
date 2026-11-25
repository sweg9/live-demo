import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { DEMO_PASSWORD, hub } from '../mocks/hub'

// Spec: GET /me on start; 401 shows sign-in. POST /login: 204, 401 wrong, 429 after 5 wrong
// within a minute. POST /logout ends the session. C-10: the app keeps no password or token.

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/history']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const signIn = async (pw: string) => {
  await screen.findByRole('button', { name: 'Sign in' }) // the last try has finished ("Signing in…" is gone)
  const field = await screen.findByLabelText('Password')
  await userEvent.clear(field)
  await userEvent.type(field, pw)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('sign-in', () => {
  it('shows the sign-in screen when signed out, and no records', async () => {
    hub.state.signedIn = false
    renderApp()
    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByText('History & stats')).toBeNull()
    expect(screen.getByText(/stop key on the hub/)).toBeInTheDocument() // C-04 without the app
  })

  it('says when the password is wrong, then signs in with the right one', async () => {
    hub.state.signedIn = false
    renderApp()
    await signIn('nope')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password.')
    await signIn(DEMO_PASSWORD)
    expect(await screen.findByRole('heading', { name: 'History & stats' })).toBeInTheDocument()
  })

  it('locks for a minute after 5 wrong passwords', async () => {
    hub.state.signedIn = false
    renderApp()
    for (let i = 0; i < 5; i++) await signIn(`wrong-${i}`)
    await signIn(DEMO_PASSWORD) // even the right one waits
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in a minute')
  })

  it('signs out and removes the records from the screen', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'History & stats' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByText(/ceiling light was turned off/)).toBeNull()
    expect(hub.state.signedIn).toBe(false)
  })

  it('C-10: keeps no password or token in the browser', async () => {
    hub.state.signedIn = false
    renderApp()
    await signIn(DEMO_PASSWORD)
    await screen.findByRole('heading', { name: 'History & stats' })
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie
    expect(stored).not.toContain(DEMO_PASSWORD)
  })
})
