import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import type { PlanItem, Situation } from '../api/proposed'
import { demoSteps } from '../live/demo'
import { initialLive, type LiveState } from '../live/live'

const since = '2026-11-26T10:00:00Z'
const at = (s: number) => new Date(Date.parse(since) + s * 1000).toISOString()
const note = (topic: string, s: number) => ({ level: 'info' as const, topic, message: topic, at: at(s) })
const lamp = (over: Partial<PlanItem>): PlanItem => ({
  device_id: 'dev-lamp', name: 'Living room stand lamp', room: 'living_room', risk: 'low', mapping_id: 'map-x', routine_id: null,
  action: 'off', decision: 'act', confidence: 0.9, method: 'press', wireless: { channel: 'IR', result: 'failure' },
  run_id: 'r-1', result: null, reason: null, resolution: null, ...over,
} as PlanItem)
const sit = (kind: string, s: number, item: PlanItem): Situation =>
  ({ situation_id: `sit-${kind}`, kind, trigger: 'sensor', summary: kind, received_at: at(s), status: 'running', plan: [item] }) as Situation

describe('Live demo steps (full_demo)', () => {
  it('nothing has started before the button', () => {
    expect(demoSteps(initialLive, null).map((s) => s.state)).toEqual(['todo', 'todo', 'todo', 'todo'])
  })

  it('FR-01, FR-02: the scan, then the flip makes the mapping Verified', () => {
    const live: LiveState = { ...initialLive, notifications: [note('flip_request', 5)] }
    expect(demoSteps(live, since).map((s) => s.state)).toEqual(['done', 'now', 'todo', 'todo'])
    const mapped: LiveState = { ...initialLive, notifications: [note('mapping_fixed', 9), note('flip_request', 5)] }
    expect(demoSteps(mapped, since).map((s) => s.state)).toEqual(['done', 'done', 'now', 'todo'])
  })

  it('C-09: off and on, each by a press after IR failed', () => {
    const live: LiveState = {
      ...initialLive,
      notifications: [note('mapping_fixed', 9), note('flip_request', 5)],
      situations: [sit('come_home', 30, lamp({ action: 'on', run_id: 'r-2' })), sit('leave_home', 15, lamp({ result: 'success' }))],
    }
    const steps = demoSteps(live, since)
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now'])
    expect(steps[2].detail).toBe('IR: failed, so the robot pressed the switch. The check confirms it.')
  })

  it('leaves out what happened before the button', () => {
    const live: LiveState = { ...initialLive, notifications: [note('mapping_fixed', -60), note('flip_request', -70)] }
    expect(demoSteps(live, since).map((s) => s.state)).toEqual(['now', 'todo', 'todo', 'todo'])
  })
})

describe('Live demo page', () => {
  it('says how to start the hub when it plays no demo scenarios', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/demo']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Run the demo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/--demo-scenarios/)
  })
})
