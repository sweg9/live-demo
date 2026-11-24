import type { RunProgress } from '../api/proposed'
import { bedtimeScenario } from '../mocks/scenario'
import { devices, mappings } from '../mocks/fixtures'
import { currentStep, initialLive, reduce, runsOf } from '../live/live'

// The mock scenario is what the team will show, so it must follow the safety rules too.

const events = bedtimeScenario().map((t) => t.event)
const progress = events.flatMap((e) => (e.kind === 'run.progress' ? [e.data] : []))
const results = events.flatMap((e) => (e.kind === 'run.result' ? [e.data] : []))
const runIds = [...new Set(progress.map((p) => p.run_id))]
const stepsOf = (id: string): RunProgress[] => progress.filter((p) => p.run_id === id)

describe('demo scenario rules', () => {
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
