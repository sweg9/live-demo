import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { LiveStateProvider } from '../live/LiveProvider'
import { initialLive, reduce, type LiveState } from '../live/live'
import { bedtimeScenario } from '../mocks/scenario'
import { http, HttpResponse } from 'msw'
import { server } from './setup'

// The live screens are drawn from LiveState only, so each test gives a state at some point
// of the scenario instead of opening a WebSocket.

const events = bedtimeScenario().map((t) => t.event)
const upTo = (n: number) => events.slice(0, n).reduce((s, event) => reduce(s, { type: 'event', event }), { ...initialLive, connected: true })
const firstIndex = (pred: (e: (typeof events)[number]) => boolean) => events.findIndex(pred)

async function renderAt(path: string, live: LiveState) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <LiveStateProvider value={live}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </LiveStateProvider>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: 'Sign out' }) // the session check (GET /me) is done
}

describe('FR-05, FR-07 Situation → run', () => {
  it('waits when nothing came in', async () => {
    await renderAt('/flow', initialLive)
    expect(screen.getByText('Waiting for a situation.')).toBeInTheDocument()
  })

  it('shows the wireless result of each device', async () => {
    const afterWireless = firstIndex((e) => e.kind === 'visits')
    await renderAt('/flow', upTo(afterWireless))
    const table = screen.getByLabelText('Wireless results')
    expect(await within(table).findByText('Ceiling light')).toBeInTheDocument()
    expect(within(table).getByText('Success')).toBeInTheDocument()
    expect(within(table).getByText('Failed')).toBeInTheDocument()
    expect(within(table).getAllByText('No wireless')).toHaveLength(2)
  })

  it('FR-09: lists the robot visits in order and tracks the press in progress', async () => {
    const pressing = firstIndex((e) => e.kind === 'run.progress' && e.data.step === 'press')
    await renderAt('/flow', upTo(pressing + 1))
    const visits = screen.getByLabelText('Visit order')
    const items = within(visits).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(await within(items[0]).findByText('Floor lamp')).toBeInTheDocument()
    const track = screen.getByLabelText('Press progress')
    expect(within(track).getByText('Pressing')).toHaveClass('now')
  })
})

describe('Situation → run, before the visit plan arrives', () => {
  it('says it is planning, not that nothing is left', async () => {
    const wirelessDone = firstIndex((e) => e.kind === 'situation' && e.data.status === 'running' && e.data.plan.every((i) => i.wireless.result !== 'pending'))
    const firstVisits = firstIndex((e) => e.kind === 'visits')
    expect(wirelessDone).toBeLessThan(firstVisits)
    await renderAt('/flow', upTo(firstVisits)) // every wireless result in, the visit list not yet
    expect(screen.getByText('Planning the visits…')).toBeInTheDocument()
    expect(screen.queryByText('Nothing left for the robot.')).toBeNull()
  })
})

describe('Now without a map', () => {
  it('says the map is not set up yet instead of an error', async () => {
    server.use(http.get('/api/map', () => HttpResponse.json({ code: 'not_found', message: 'No such route' }, { status: 404 })))
    await renderAt('/', { ...initialLive, connected: true })
    expect(await screen.findByText('The home map is not set up yet.')).toBeInTheDocument()
  })
})

describe('Now', () => {
  it('the robot card shows the task the hub reports, in plain words', async () => {
    const gate = firstIndex((e) => e.kind === 'robot' && e.data.task?.step === 'gate')
    await renderAt('/', upTo(gate + 1))
    const card = within(screen.getByLabelText('Robot'))
    expect(card.getByText('Safety check')).toBeInTheDocument()
    expect(card.getByText(/Safety gate: no person in the work area/)).toBeInTheDocument()
  })

  it('reads a situation as it was after a reload (snapshot), not only from events', async () => {
    const end = upTo(events.length)
    await renderAt('/', { ...initialLive, connected: true, situations: end.situations, robot: end.robot, visits: end.visits })
    expect(screen.getAllByText('It is 23:00: the bedtime routine started.')[0]).toBeInTheDocument()
    expect(screen.getByText('Finished (4)')).toBeInTheDocument()
  })

  it('shows the situation, the robot and the finished runs', async () => {
    await renderAt('/', upTo(events.length))
    expect(screen.getAllByText('It is 23:00: the bedtime routine started.')[0]).toBeInTheDocument()
    expect(within(screen.getByLabelText('Robot')).getByText('Idle')).toBeInTheDocument()
    expect(screen.getByText('Finished (4)')).toBeInTheDocument()
    // C-03: the high-risk run is in the list and in a notification
    const notes = screen.getByRole('heading', { name: 'Notifications' }).parentElement!.nextElementSibling as HTMLElement
    expect(within(notes).getByText(/did not switch off the heater/)).toBeInTheDocument()
  })

  it('C-05: shows no camera stream', async () => {
    await renderAt('/', upTo(events.length))
    expect(document.querySelector('video, img[src*="stream"]')).toBeNull()
  })
})
