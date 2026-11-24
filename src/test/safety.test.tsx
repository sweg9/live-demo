import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import App from '../App'
import { NAV } from '../components/Layout'
import { FALLBACK } from '../components/EmergencyStop'
import { server } from './setup'

async function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: 'Sign out' }) // the session check (GET /me) is done
}

describe('FR-10 emergency stop (C-04)', () => {
  it.each(NAV.map((n) => n.to))('is on screen at %s', async (path) => {
    await renderAt(path)
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeEnabled()
  })

  it('says the robot stopped when the server confirms', async () => {
    await renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }))
    expect(await screen.findByText('Robot stopped.')).toBeInTheDocument()
  })

  it('points to the hub key when the stop is not confirmed (504)', async () => {
    server.use(
      http.post('/api/stop', () =>
        HttpResponse.json({ code: 'stop_not_confirmed', message: 'The stop was not confirmed.' }, { status: 504 }),
      ),
    )
    await renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }))
    expect(await screen.findByText(new RegExp(FALLBACK.replace('.', '\\.')))).toBeInTheDocument()
  })

  it('points to the hub key when the hub is offline (503)', async () => {
    server.use(
      http.post('/api/stop', () =>
        HttpResponse.json({ code: 'hub_offline', message: 'The hub at home is offline' }, { status: 503 }),
      ),
    )
    await renderAt('/')
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }))
    expect(await screen.findByText(/hub at home is offline.*stop key on the hub/)).toBeInTheDocument()
  })
})

describe('FR-06 pause proactive features (C-06)', () => {
  it('is on screen and shows the state the server confirmed', async () => {
    await renderAt('/history')
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByText('Automation: paused')).toBeInTheDocument()
  })
})
