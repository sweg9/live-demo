import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { HomeMap } from '../map/HomeMap'
import { buildScene, highlighted, robotPoint, visitStops } from '../map/model'
import { controls, devices, mappings } from '../mocks/fixtures'
import { layout } from '../mocks/layout'

const spot = (controlId: string) => layout.controls.find((c) => c.control_id === controlId)!.press_spot
const withRejected = mappings.map((m) => (m.mapping_id === 'map-2' ? { ...m, status: 'Rejected' as const } : m))
const scene = buildScene(layout, controls, devices, mappings)

describe('map model', () => {
  it('FR-02, C-08: Verified links are solid, Pending and Stale dashed, Rejected not drawn', () => {
    const { container } = render(<HomeMap scene={buildScene(layout, controls, devices, withRejected)} />)
    expect(container.querySelector('[data-testid=link-map-1]')).not.toHaveAttribute('stroke-dasharray') // Verified
    expect(container.querySelector('[data-testid=link-map-3]')).toHaveAttribute('stroke-dasharray') // Stale
    expect(container.querySelector('[data-testid=link-map-2]')).toBeNull() // Rejected
  })

  it('places every control and device inside a room of the layout', () => {
    // Guards the scan-derived rooms against estimates that fall outside them.
    const inside = (p: { x: number; y: number }) => layout.rooms.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
    for (const c of layout.controls) expect(inside(c.at) && inside(c.press_spot), c.control_id).toBe(true)
    for (const d of layout.devices) expect(inside(d.at), d.device_id).toBe(true)
    expect(inside(layout.dock)).toBe(true)
  })

  it('marks a power strip as caution', () => {
    expect(scene.controls.find((c) => c.id === 'ctl-bed-strip')?.caution).toBe(true)
    expect(scene.controls.filter((c) => c.caution)).toHaveLength(1)
  })

  it('highlights a switch with its link and device', () => {
    expect(highlighted(scene, { kind: 'control', id: 'ctl-living-1' })).toEqual(new Set(['ctl-living-1', 'map-1', 'dev-ceiling']))
    expect(highlighted(scene, null).size).toBe(0)
  })

  it('puts the robot at the last spot it reported, else at the dock', () => {
    expect(robotPoint(scene, { spot_id: 'spot-living-3' })).toEqual(spot('ctl-living-3'))
    expect(robotPoint(scene, { spot_id: 'dock' })).toEqual(layout.dock)
    expect(robotPoint(scene, { spot_id: 'somewhere-new' })).toEqual(layout.dock)
  })

  it('numbers the visits by order and marks the finished ones', () => {
    const visit = (order: number, spot_id: string, status: 'done' | 'waiting') =>
      ({ visit_id: `v${order}`, order, situation_id: 's', spot_id, control_id: null, device_id: 'd', run_id: null, reason: 'no_channel' as const, status })
    expect(visitStops(scene, [visit(2, 'spot-bed-2', 'waiting'), visit(1, 'spot-living-3', 'done')])).toEqual([
      { n: 1, at: spot('ctl-living-3'), key: 'v1', done: true },
      { n: 2, at: spot('ctl-bed-2'), key: 'v2', done: false },
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
    expect(within(map).getByRole('button', { name: 'Ceiling light, Room A' })).toHaveClass('hl')
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
