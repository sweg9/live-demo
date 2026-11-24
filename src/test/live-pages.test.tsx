import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { LiveStateProvider } from '../live/LiveProvider'
import { initialLive, reduce, type LiveState } from '../live/live'
import { bedtimeScenario } from '../mocks/scenario'

// The live screens are drawn from LiveState only, so each test gives a state at some point
// of the scenario instead of opening a WebSocket.

const events = bedtimeScenario().map((t) => t.event)
const upTo = (n: number) => events.slice(0, n).reduce((s, event) => reduce(s, { type: 'event', event }), { ...initialLive, connected: true })
const firstIndex = (pred: (e: (typeof events)[number]) => boolean) => events.findIndex(pred)

function renderAt(path: string, live: LiveState) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LiveStateProvider value={live}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </LiveStateProvider>
    </QueryClientProvider>,
  )
}

describe('FR-05, FR-07 Situation → run', () => {
  it('waits when nothing came in', () => {
    renderAt('/flow', initialLive)
    expect(screen.getByText('Waiting for a situation.')).toBeInTheDocument()
  })

  it('shows the wireless result of each device', async () => {
    const afterWireless = firstIndex((e) => e.kind === 'robot.plan')
    renderAt('/flow', upTo(afterWireless))
    const table = screen.getByLabelText('Wireless results')
    expect(await within(table).findByText('Ceiling light')).toBeInTheDocument()
    expect(within(table).getByText('Success')).toBeInTheDocument()
    expect(within(table).getByText('Failed')).toBeInTheDocument()
    expect(within(table).getAllByText('No wireless')).toHaveLength(2)
  })

  it('FR-09: lists the robot visits in order and tracks the press in progress', async () => {
    const pressing = firstIndex((e) => e.kind === 'run.progress' && e.data.step === 'press')
    renderAt('/flow', upTo(pressing + 1))
    const visits = screen.getByLabelText('Visit order')
    const items = within(visits).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(await within(items[0]).findByText('Floor lamp')).toBeInTheDocument()
    const track = screen.getByLabelText('Press progress')
    expect(within(track).getByText('Pressing')).toHaveClass('now')
  })
})

describe('Now', () => {
  it('shows the situation, the robot and the finished runs', async () => {
    renderAt('/', upTo(events.length))
    expect(screen.getByText('It is 23:00: the bedtime routine started.')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Robot')).getByText('Idle')).toBeInTheDocument()
    expect(screen.getByText('Finished (4)')).toBeInTheDocument()
    expect(screen.getByText(/did not press/)).toBeInTheDocument() // the high-risk notification
  })

  it('C-05: shows no camera stream', () => {
    renderAt('/', upTo(events.length))
    expect(document.querySelector('video, img[src*="stream"]')).toBeNull()
  })
})
