import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { HomeMap } from '../map/HomeMap'
import { buildScene, highlighted, robotPoint, routeOf } from '../map/model'
import { controls, devices, mappings } from '../mocks/fixtures'
import { layout } from '../mocks/layout'

const withRejected = mappings.map((m) => (m.mapping_id === 'map-2' ? { ...m, status: 'Rejected' as const } : m))
const scene = buildScene(layout, controls, devices, mappings)

describe('map model', () => {
  it('C-08: confirmed links are solid, guesses dashed, rejected not drawn', () => {
    const { container } = render(<HomeMap scene={buildScene(layout, controls, devices, withRejected)} />)
    expect(container.querySelector('[data-testid=link-map-1]')).not.toHaveAttribute('stroke-dasharray') // Verified
    expect(container.querySelector('[data-testid=link-map-3]')).toHaveAttribute('stroke-dasharray') // Stale
    expect(container.querySelector('[data-testid=link-map-2]')).toBeNull() // Rejected
  })

  it('marks a power strip as caution', () => {
    expect(scene.controls.find((c) => c.id === 'ctl-bed-strip')?.caution).toBe(true)
    expect(scene.controls.filter((c) => c.caution)).toHaveLength(1)
  })

  it('highlights a switch with its link and device', () => {
    expect(highlighted(scene, { kind: 'control', id: 'ctl-living-1' })).toEqual(new Set(['ctl-living-1', 'map-1', 'dev-ceiling']))
    expect(highlighted(scene, null).size).toBe(0)
  })

  it('puts the robot at the press spot of the Verified control, else at the dock', () => {
    expect(robotPoint(scene, mappings, { state: 'busy', device_id: 'dev-floor' })).toEqual({ x: 330, y: 70 })
    expect(robotPoint(scene, mappings, { state: 'idle' })).toEqual(layout.dock)
    // The desk lamp's mapping is Stale: the robot never goes there for it (C-08)
    expect(robotPoint(scene, mappings, { state: 'busy', device_id: 'dev-desk' })).toEqual(layout.dock)
  })

  it('numbers the visits and marks the done ones', () => {
    const visits = [
      { device_id: 'dev-floor', run_id: 'a', why: 'no_wireless' as const },
      { device_id: 'dev-purifier', run_id: 'b', why: 'wireless_failed' as const },
    ]
    expect(routeOf(scene, mappings, visits, (id) => id === 'a')).toEqual([
      { n: 1, at: { x: 330, y: 70 }, deviceId: 'dev-floor', done: true },
      { n: 2, at: { x: 760, y: 70 }, deviceId: 'dev-purifier', done: false },
    ])
  })
})

describe('FR-02 mappings on the map', () => {
  function renderMappings() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/mappings']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('selecting a switch highlights its device and its row, and shows its tag', async () => {
    renderMappings()
    const map = await screen.findByRole('img', { name: 'Switches and devices on the home map' })
    await userEvent.click(within(map).getByRole('button', { name: 'Switch → Ceiling light' }))
    expect(within(map).getByRole('button', { name: 'Ceiling light, Living room' })).toHaveClass('hl')
    expect(screen.getByRole('cell', { name: 'Ceiling light' }).closest('tr')).toHaveClass('hl')
    expect(within(screen.getByLabelText('Selected item')).getByText(/ctl-living-1/)).toBeInTheDocument()
  })

  it('works from the keyboard and shows the caution tag', async () => {
    renderMappings()
    const map = await screen.findByRole('img', { name: 'Switches and devices on the home map' })
    within(map).getByRole('button', { name: /Power strip.*caution/ }).focus()
    await userEvent.keyboard('{Enter}')
    expect(within(screen.getByLabelText('Selected item')).getByText(/do not press directly/)).toBeInTheDocument()
  })
})
