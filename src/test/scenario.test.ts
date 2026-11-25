import type { LiveEvent, RunProgress } from '../api/proposed'
import { askingScenario, bedtimeScenario, EMERGENCY, retryScenario, routeScenario } from '../mocks/scenario'
import { devices, mappings, runs as fixtureRuns } from '../mocks/fixtures'
import { hub } from '../mocks/hub'
import { acted, currentStep, initialLive, reduce, visitsOf } from '../live/live'

// The mock scenarios are what the team will show, so they must follow the safety rules too, and
// the order the hub keeps (spec 0.5.0).

const run = (id: string) => fixtureRuns.find((r) => r.run_id === id)!
const asked = askingScenario()
const SCENARIOS: Record<string, LiveEvent[]> = {
  bedtime: bedtimeScenario().map((t) => t.event),
  'asks first, then yes': [...asked.events, ...asked.answer!(true)].map((t) => t.event),
  'retry after a failed gate (heater)': retryScenario(run('run-3'), 'run-new-1', null).map((t) => t.event),
  'retry after a Wi-Fi failure (ceiling light)': retryScenario(run('run-1'), 'run-new-2', null).map((t) => t.event),
}
const events = SCENARIOS.bedtime

describe.each(Object.entries(SCENARIOS))('scenario rules: %s', (name, events) => {
  const progress = events.flatMap((e) => (e.kind === 'run.progress' ? [e.data] : []))
  const results = events.flatMap((e) => (e.kind === 'run.result' ? [e.data] : []))
  const runIds = [...new Set(progress.map((p) => p.run_id))]
  const stepsOf = (id: string): RunProgress[] => progress.filter((p) => p.run_id === id)

  it('FR-10, FR-11, C-04: every press comes right after a passed safety gate, at most 2 per run', () => {
    for (const id of runIds) {
      const steps = stepsOf(id)
      steps.forEach((s, i) => {
        if (s.step !== 'press') return
        const gate = steps.slice(0, i).reverse().find((x) => x.gate || x.step === 'press')
        expect(gate, `${id} pressed without a gate`).toMatchObject({ step: 'gate', gate: 'pass' })
      })
      expect(steps.filter((s) => s.step === 'press').length).toBeLessThanOrEqual(2)
    }
  })

  it('C-04: a failed gate means no press and a cancelled run', () => {
    for (const id of runIds) {
      const steps = stepsOf(id)
      if (!steps.some((s) => s.gate === 'fail')) continue
      expect(steps.some((s) => s.step === 'press')).toBe(false)
      expect(results.find((r) => r.run_id === id)?.result).toBe('cancelled')
    }
  })

  it('FR-07, FR-08, FR-11, C-09: wireless before any press, and unsure never leads to another press', () => {
    for (const id of runIds) {
      const steps = stepsOf(id)
      const press = steps.findIndex((s) => s.step === 'press')
      // A retry presses at once: its wireless was tried by the run it tries again.
      if (press >= 0 && !results.find((r) => r.run_id === id)?.retry_of) {
        const wireless = steps.findIndex((s) => s.step === 'wireless' && s.wireless)
        expect(wireless, `${id} pressed before any wireless outcome`).toBeGreaterThanOrEqual(0)
        expect(wireless).toBeLessThan(press)
      }
      const unsure = steps.findIndex((s) => s.step === 'check' && s.answer === 'unsure')
      if (unsure >= 0) expect(steps.slice(unsure).some((s) => s.step === 'press')).toBe(false)
    }
  })

  it('C-09: every run ends with exactly one result', () => {
    for (const id of runIds) expect(results.filter((r) => r.run_id === id)).toHaveLength(1)
  })

  it('C-08: only devices with a Verified mapping are operated', () => {
    for (const id of runIds) {
      const device = stepsOf(id)[0].device_id
      expect(mappings.some((m) => m.device_id === device && m.status === 'Verified'), device).toBe(true)
    }
  })

  it('C-03: every run of a high-risk device is followed by a notification', () => {
    const high = new Set(devices.filter((d) => d.risk === 'high').map((d) => d.device_id))
    results
      .filter((r) => r.device_id && high.has(r.device_id))
      .forEach((r) => {
        const at = events.findIndex((e) => e.kind === 'run.result' && e.data.run_id === r.run_id)
        expect(events.slice(at).some((e) => e.kind === 'notification' && e.data.run_id === r.run_id)).toBe(true)
      })
  })

  it("the robot never shows a step its run has not sent yet (run.progress first)", () => {
    events.forEach((e, i) => {
      const task = e.kind === 'robot' ? e.data.task : null
      if (!task?.run_id) return
      const sent = events.slice(0, i).some((x) => x.kind === 'run.progress' && x.data.run_id === task.run_id && x.data.step === task.step)
      expect(sent, `${name}: event ${i} (${task.step})`).toBe(true)
    })
  })
})

describe('FR-11: one more press after a failed check, like the hub', () => {
  const floor = events.flatMap((e) => (e.kind === 'run.progress' && e.data.device_id === 'dev-floor' ? [e.data] : []))

  it('presses twice, each after a passed gate, when the first check says no', () => {
    expect(floor.filter((p) => p.step === 'press').map((p) => p.text)).toEqual(['press', 'press again'])
    expect(floor.filter((p) => p.gate).map((p) => p.gate)).toEqual(['pass', 'pass'])
    expect(floor.filter((p) => p.step === 'check' && p.answer).map((p) => p.answer)).toEqual(['no', 'yes'])
  })
})

describe('move order (robot.route)', () => {
  const route = routeScenario('route-t', ['spot-living-3', 'spot-bed-2']).map((t) => t.event)
  const robot = route.flatMap((e) => (e.kind === 'robot' ? [e.data] : []))
  const orders = route.flatMap((e) => (e.kind === 'robot.route' ? [e.data] : []))

  it('C-04: checks the way before every leg, and never presses', () => {
    const steps = robot.map((r) => r.task?.step).filter((s, i, xs) => s && s !== xs[i - 1]) // one per change
    steps.forEach((s, i) => s === 'move' && expect(steps[i - 1]).toBe('gate'))
    expect(robot.some((r) => r.task?.step === 'press')).toBe(false)
    expect(route.some((e) => e.kind === 'run.progress' || e.kind === 'run.result')).toBe(false)
  })

  it('reaches every stop in order and leaves the robot at the last one', () => {
    expect(orders.map((o) => o.reached)).toEqual([0, 1, 2, 2])
    expect(orders.at(-1)).toMatchObject({ state: 'done', reason: null })
    expect(robot.at(-1)).toMatchObject({ state: 'idle', spot_id: 'spot-bed-2', task: null })
  })

  it('C-04: a blocked way ends the order as cancelled, with a notification, and no move', () => {
    const blocked = routeScenario('route-b', ['spot-living-3'], undefined, undefined, 0).map((t) => t.event)
    expect(blocked.some((e) => e.kind === 'robot' && e.data.state === 'moving')).toBe(false)
    expect(blocked.flatMap((e) => (e.kind === 'robot.route' ? [e.data.state] : []))).toEqual(['moving', 'cancelled'])
    expect(blocked.some((e) => e.kind === 'notification' && e.data.topic === 'route_cancelled')).toBe(true)
  })
})

describe('mock hub', () => {
  afterEach(() => hub.reset())

  it('FR-10, C-09: the emergency stop ends every open run as cancelled with reason "emergency stop"', () => {
    const sent: LiveEvent[] = []
    hub.send = (e) => sent.push(e)
    const firstPress = events.findIndex((e) => e.kind === 'run.progress' && e.data.step === 'press')
    events.slice(0, firstPress + 1).forEach((e) => hub.emit(e))
    const open = [...hub.state.active.keys()]
    expect(open.length).toBeGreaterThan(0)
    hub.stop()
    const cancelled = sent.flatMap((e) => (e.kind === 'run.result' && e.data.reason === EMERGENCY ? [e.data.run_id] : []))
    expect(cancelled.sort()).toEqual(open.sort())
    expect(hub.state.robot).toMatchObject({ state: 'stopped', task: null, plan: [] })
    expect(hub.state.visits.every((v) => ['done', 'failed', 'cancelled'].includes(v.status))).toBe(true)
    expect(hub.timers).toHaveLength(0)
  })

  it('FR-10: the emergency stop cancels a move order', () => {
    const sent: LiveEvent[] = []
    hub.send = (e) => sent.push(e)
    const order = routeScenario('route-s', ['spot-living-3', 'spot-bed-2']).map((t) => t.event)
    order.slice(0, 3).forEach((e) => hub.emit(e))
    hub.stop()
    expect(sent.filter((e) => e.kind === 'robot.route').at(-1)?.data).toMatchObject({ state: 'cancelled', reason: EMERGENCY })
  })

  it('refuses a move order while the robot is busy, and a device without a Verified switch (C-08)', () => {
    expect(hub.route(['dev-desk'])).toMatchObject({ status: 409, body: { code: 'not_verified' } })
    expect(hub.route(['nowhere'])).toMatchObject({ status: 404, body: { code: 'unknown_stop' } })
    hub.state.robot = { ...hub.state.robot, state: 'moving' }
    expect(hub.route(['dev-floor'])).toMatchObject({ status: 409, body: { code: 'robot_busy' } })
  })

  it('C-09: answers a retry with the new run and keeps the choice on the run', () => {
    const r = hub.retry('run-3')
    expect(r.status).toBe(202)
    const choice = r.body as { run_id: string; choice: string; retry_run_id: string }
    expect(choice).toMatchObject({ run_id: 'run-3', choice: 'retry' })
    expect(hub.state.runs.find((x) => x.run_id === 'run-3')?.resolution).toEqual({ choice: 'retry', retry_run_id: choice.retry_run_id })
    expect(hub.retry('run-3')).toMatchObject({ status: 409, body: { code: 'already_chosen' } })
    expect(hub.leave('run-5')).toMatchObject({ status: 409, body: { code: 'not_failed' } })
  })

  it('FR-06: a situation that asks waits until the resident answers; no means nothing is done', () => {
    vi.useFakeTimers()
    hub.start(askingScenario())
    vi.runAllTimers()
    const sid = [...hub.state.waiting.keys()][0]
    expect(hub.state.situations.get(sid)?.status).toBe('waiting_for_answer')
    expect(hub.answer(sid, false)).toMatchObject({ status: 200, body: { status: 'dismissed' } })
    vi.runAllTimers()
    expect(hub.state.situations.get(sid)?.status).toBe('dismissed')
    expect(hub.state.active.size).toBe(0) // nothing started
    expect(hub.answer(sid, true)).toMatchObject({ status: 409, body: { code: 'not_waiting' } })
    vi.useRealTimers()
  })
})

describe('live state', () => {
  const end = events.reduce((s, event) => reduce(s, { type: 'event', event }), initialLive)
  const sit = end.situations[0]

  it('keeps the situation with every planned run and its result', () => {
    expect(sit.status).toBe('needs_attention') // the purifier is unsure: the resident chooses
    expect(acted(sit).map((i) => i.result).sort()).toEqual(['cancelled', 'success', 'success', 'unsure'])
    expect(Object.values(end.runs).every((r) => currentStep(r) === 'done')).toBe(true)
  })

  it('keeps the visit order and returns the robot to the dock', () => {
    expect(visitsOf(end, sit.situation_id).map((v) => v.reason)).toEqual(['no_channel', 'wireless_failed', 'no_channel'])
    expect(end.robot).toMatchObject({ state: 'idle', spot_id: 'dock', task: null })
  })

  it('fills from a snapshot after a reload', () => {
    const s = reduce(initialLive, { type: 'snapshot', value: { situations: [sit], visits: end.visits, robot: end.robot } })
    expect(s.situations[0].situation_id).toBe(sit.situation_id)
    expect(s.visits).toHaveLength(3)
  })

  it('ignores kinds the lists cover', () => {
    const s = reduce(initialLive, { type: 'event', event: { kind: 'scan', data: {} } })
    expect(s).toBe(initialLive)
  })
})
