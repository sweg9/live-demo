import type { LiveEvent, RunProgress } from '../api/proposed'
import { bedtimeScenario, retryScenario, routeScenario } from '../mocks/scenario'
import { devices, mappings, runs as fixtureRuns } from '../mocks/fixtures'
import { hub } from '../mocks/hub'
import { currentStep, initialLive, reduce, runsOf } from '../live/live'

// The mock scenarios are what the team will show, so they must follow the safety rules too.

const run = (id: string) => fixtureRuns.find((r) => r.run_id === id)!
const SCENARIOS: Record<string, LiveEvent[]> = {
  bedtime: bedtimeScenario().map((t) => t.event),
  'retry after a failed gate (heater)': retryScenario(run('run-3'), 'map-4').map((t) => t.event),
  'retry after a Wi-Fi failure (ceiling light)': retryScenario(run('run-1'), 'map-1').map((t) => t.event),
}
const events = SCENARIOS.bedtime

describe.each(Object.entries(SCENARIOS))('scenario rules: %s', (_name, events) => {
  const progress = events.flatMap((e) => (e.kind === 'run.progress' ? [e.data] : []))
  const results = events.flatMap((e) => (e.kind === 'run.result' ? [e.data] : []))
  const runIds = [...new Set(progress.map((p) => p.run_id))]
  const stepsOf = (id: string): RunProgress[] => progress.filter((p) => p.run_id === id)

  it('C-04: every press comes right after a passed safety gate, at most 2 per run', () => {
    for (const id of runIds) {
      const steps = stepsOf(id)
      steps.forEach((s, i) => {
        if (s.step !== 'press') return
        const gate = steps.slice(0, i).reverse().find((x) => x.step === 'gate' || x.step === 'press')
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

  it('C-09: wireless is tried before any press, and unsure never leads to another press', () => {
    for (const id of runIds) {
      const steps = stepsOf(id)
      const wireless = steps.findIndex((s) => s.stage === 'S5')
      const press = steps.findIndex((s) => s.step === 'press')
      if (press >= 0) expect(wireless).toBeGreaterThanOrEqual(0)
      if (press >= 0) expect(wireless).toBeLessThan(press)
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

  it('C-03: a high-risk device run is followed by a notification', () => {
    const high = new Set(devices.filter((d) => d.risk === 'high').map((d) => d.device_id))
    results
      .filter((r) => r.device_id && high.has(r.device_id))
      .forEach((r) => {
        const at = events.findIndex((e) => e.kind === 'run.result' && e.data.run_id === r.run_id)
        expect(events.slice(at).some((e) => e.kind === 'notification')).toBe(true)
      })
  })
})

describe('move order (robot.route)', () => {
  const route = routeScenario('route-t', ['dev-floor', 'dev-purifier']).map((t) => t.event)
  const robot = route.flatMap((e) => (e.kind === 'robot.status' ? [e.data] : []))

  it('C-04: checks the way before every move, and never presses', () => {
    robot.forEach((s, i) => {
      if (s.step === 'move') expect(robot[i - 1]).toMatchObject({ step: 'gate', device_id: s.device_id })
    })
    expect(robot.some((s) => s.step === 'press')).toBe(false)
    expect(route.some((e) => e.kind === 'run.progress' || e.kind === 'run.result')).toBe(false)
  })

  it('reaches every stop in order and leaves the robot at the last one', () => {
    const reached = route.flatMap((e) => (e.kind === 'robot.route' ? [e.data.reached] : []))
    expect(reached).toEqual([0, 1, 2])
    expect(robot.at(-1)).toMatchObject({ state: 'idle', device_id: 'dev-purifier' })
  })
})

describe('mock hub: emergency stop', () => {
  afterEach(() => hub.reset())

  it('C-09: ends every open run as cancelled with reason "emergency stop"', () => {
    const sent: LiveEvent[] = []
    hub.send = (e) => sent.push(e)
    // Play the bedtime scenario up to the first press, then stop.
    const firstPress = events.findIndex((e) => e.kind === 'run.progress' && e.data.step === 'press')
    events.slice(0, firstPress + 1).forEach((e) => hub.emit(e))
    const open = [...hub.state.active.keys()]
    expect(open.length).toBeGreaterThan(0)
    hub.stop()
    const cancelled = sent.flatMap((e) => (e.kind === 'run.result' && e.data.reason === 'emergency stop' ? [e.data.run_id] : []))
    expect(cancelled.sort()).toEqual(open.sort())
    expect(sent.at(-1)).toEqual({ kind: 'robot.status', data: { state: 'stopped' } })
    expect(hub.timers).toHaveLength(0)
  })

  it('refuses a move order while the robot is busy', () => {
    hub.state.robot = 'busy'
    expect(hub.route(['dev-floor']).status).toBe(409)
  })
})

describe('live state', () => {
  const end = events.reduce((s, event) => reduce(s, { type: 'event', event }), initialLive)
  const sid = end.situations[0].situation_id

  it('collects every run of the situation with its result', () => {
    const runs = runsOf(end, sid)
    expect(runs).toHaveLength(4)
    expect(runs.every((r) => currentStep(r) === 'done')).toBe(true)
    expect(runs.map((r) => r.result?.result).sort()).toEqual(['cancelled', 'success', 'success', 'unsure'])
  })

  it('keeps the visit order and returns the robot to idle', () => {
    expect(end.plans[sid].map((v) => v.why)).toEqual(['no_wireless', 'wireless_failed', 'no_wireless'])
    expect(end.robot.state).toBe('idle')
  })

  it('ignores routines without a situation and unknown kinds', () => {
    const s = reduce(initialLive, { type: 'event', event: { kind: 'scan', data: {} } })
    expect(s).toBe(initialLive)
  })
})
