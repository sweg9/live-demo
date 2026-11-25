import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { LiveStateProvider } from '../live/LiveProvider'
import { IDLE_ROBOT, initialLive, type LiveState } from '../live/live'
import { hub } from '../mocks/hub'

function renderRobot(live: LiveState = { ...initialLive, connected: true }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LiveStateProvider value={live}>
        <MemoryRouter initialEntries={['/robot']}>
          <App />
        </MemoryRouter>
      </LiveStateProvider>
    </QueryClientProvider>,
  )
}

const map = () => screen.findByRole('img', { name: 'Pick places for the robot' })

describe('Send the robot', () => {
  it('builds an ordered list of stops and sends it', async () => {
    renderRobot()
    const m = await map()
    await userEvent.click(within(m).getByRole('button', { name: 'Floor lamp, Room A' }))
    await userEvent.click(within(m).getByRole('button', { name: 'Air purifier, Room B' }))
    expect(within(screen.getByRole('list', { name: 'Stops' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Floor lamp', 'Air purifier'])
    await userEvent.click(screen.getByRole('button', { name: 'Go: 2 stops' }))
    expect(await screen.findByText('No place picked.')).toBeInTheDocument()
    expect(hub.state.routes).toBe(1)
  })

  it('C-08: will not add a device without a Verified switch', async () => {
    renderRobot()
    await userEvent.click(within(await map()).getByRole('button', { name: 'Desk lamp, Room B' })) // Stale mapping
    expect(screen.getByText(/no Verified switch yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go here' })).toBeDisabled()
  })

  it('cannot send while the robot is busy', async () => {
    const task = { run_id: 'r', device_id: 'dev-floor', stage: 'S6' as const, step: 'press' as const, text: 'press', method: 'press' as const, channel: 'ARM' as const }
    renderRobot({ ...initialLive, connected: true, robot: { ...IDLE_ROBOT, state: 'pressing', task } })
    await userEvent.click(within(await map()).getByRole('button', { name: 'Air purifier, Room B' }))
    expect(screen.getByRole('button', { name: 'Go here' })).toBeDisabled()
    expect(screen.getByText(/The robot is busy: Press/)).toBeInTheDocument()
  })

  it('shows a stopped move order', async () => {
    renderRobot({ ...initialLive, connected: true, route: { route_id: 'r', stops: ['spot-living-3', 'spot-bed-2'], reached: 1, state: 'cancelled', reason: 'emergency stop' } })
    expect(await screen.findByText(/Stopped on the way \(emergency stop\)\. 1 of 2 reached\./)).toBeInTheDocument()
  })
})
