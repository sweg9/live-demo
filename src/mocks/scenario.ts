import type { Run } from '../api/client'
import type { Channel, LiveEvent, RunProgress, Situation } from '../api/proposed'
import { devices } from './fixtures'

// Live events the mock plays with delays (its stand-in for the hub). Tests in
// src/test/scenario.test.ts hold every scenario to C-03, C-04, C-08 and C-09.
//
// The bedtime scenario shows every path the dashboard must handle:
//   Ceiling light  WIFI works                                   → success (S5)
//   Floor lamp     no wireless channel → press, check yes       → success (S6)
//   Air purifier   IR fails → press, check unsure twice         → unsure, never pressed again (C-09)
//   Heater         no wireless → safety gate fails              → cancelled (C-04), notified (C-03)

export type Timed = { delayMs: number; event: LiveEvent }

const STEP_MS = 900 // pacing of the demo only, not a product value

export type Plan = {
  key: string
  device_id: string
  mapping_id: string
  intent: string
  wireless: { channel: Channel; works: boolean } | null
  gate?: 'pass' | 'fail'
  checks?: Array<'yes' | 'no' | 'unsure'>
}

const BEDTIME: Plan[] = [
  { key: 'ceiling', device_id: 'dev-ceiling', mapping_id: 'map-1', intent: 'Turn off the ceiling light', wireless: { channel: 'WIFI', works: true } },
  { key: 'floor', device_id: 'dev-floor', mapping_id: 'map-5', intent: 'Turn off the floor lamp', wireless: null, gate: 'pass', checks: ['yes'] },
  { key: 'purifier', device_id: 'dev-purifier', mapping_id: 'map-6', intent: 'Turn off the air purifier', wireless: { channel: 'IR', works: false }, gate: 'pass', checks: ['unsure', 'unsure'] },
  { key: 'heater', device_id: 'dev-heater', mapping_id: 'map-4', intent: 'Turn off the heater', wireless: null, gate: 'fail' },
]

let played = 0
const device = (id: string) => devices.find((d) => d.device_id === id)
const name = (id: string) => device(id)?.name.toLowerCase() ?? id
const room = (id: string) => device(id)?.room
const highRiskNote = (p: Plan, result: Run['result']) =>
  ({
    success: `The ${name(p.device_id)} was turned off.`,
    cancelled: `The ${name(p.device_id)} is still on. Someone was near it, so the robot did not press.`,
    unsure: `The robot pressed the ${name(p.device_id)} switch, but could not confirm it is off. Please check it.`,
    failure: `The ${name(p.device_id)} could not be turned off. Please check it.`,
  })[result]
const label = (c: Channel) =>({ IR: 'IR', WIFI: 'Wi-Fi', BT: 'Bluetooth', ARM: 'a press' })[c]

type Situate = Omit<Situation, 'situation_id' | 'at'> & { runTrigger: Run['trigger']; routines: boolean }

/** One situation and its runs: wireless first for every device (S5), then the robot (S6). */
export function playRuns(situation: Situate, plans: Plan[], now = () => new Date()): Timed[] {
  const n = ++played
  const sid = `sit-${n}`
  const runId = (p: Plan) => `run-${n}-${p.key}`
  const out: Timed[] = []
  const emit = (event: LiveEvent, delayMs = STEP_MS) => out.push({ delayMs, event })
  const progress = (p: Plan, d: Omit<RunProgress, 'run_id' | 'situation_id' | 'device_id'>) =>
    emit({ kind: 'run.progress', data: { run_id: runId(p), situation_id: sid, device_id: p.device_id, ...d } })
  const result = (p: Plan, r: Pick<Run, 'result' | 'channel' | 'explanation'> & { reason?: string }) => {
    emit({
      kind: 'run.result',
      data: {
        run_id: runId(p), situation_id: sid, trigger: situation.runTrigger, intent: p.intent, device_id: p.device_id,
        confidence: 0.9, started_at: now().toISOString(), ...r,
      },
    })
    // C-03: a high-risk device gets a notification on every run, whatever the result.
    if (device(p.device_id)?.risk === 'high') emit({ kind: 'notification', data: { text: highRiskNote(p, r.result) } }, 200)
  }

  emit({ kind: 'situation', data: { situation_id: sid, trigger: situation.trigger, summary: situation.summary, at: now().toISOString() } }, 300)
  if (situation.routines) {
    for (const p of plans) {
      emit({ kind: 'routine', data: { routine_id: `rt-${n}-${p.key}`, situation_id: sid, mapping_id: p.mapping_id, action: 'off', time: '23:00', source: 'habit', independence: 'act_and_tell', priority: 1 } }, 400)
    }
  }
  for (const p of plans) progress(p, { stage: 'S4', step: 'decide' })

  // S5: wireless first, for every device (C-09)
  const visits: Plan[] = []
  for (const p of plans) {
    if (!p.wireless) {
      progress(p, { stage: 'S5', step: 'wireless', wireless: 'no_wireless' })
      visits.push(p)
      continue
    }
    const { channel, works } = p.wireless
    progress(p, { stage: 'S5', step: 'check', channel, answer: works ? 'yes' : 'no' })
    progress(p, { stage: 'S5', step: 'wireless', channel, wireless: works ? 'success' : 'failure' })
    if (works) result(p, { result: 'success', channel, explanation: `The ${name(p.device_id)} was turned off over ${label(channel)}.` })
    else visits.push(p)
  }

  // S6: the robot visits what is left, in order, started by the system
  if (visits.length) {
    emit({ kind: 'robot.plan', data: { situation_id: sid, visits: visits.map((p) => ({ device_id: p.device_id, run_id: runId(p), why: p.wireless ? 'wireless_failed' : 'no_wireless' })) } })
    for (const p of visits) progress(p, { stage: 'S6', step: 'queued' })
  }

  for (const p of visits) {
    // The run moves on first, then the robot reports it: the robot card never shows a step
    // older than the run's own.
    progress(p, { stage: 'S6', step: 'move' })
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: p.device_id, step: 'move', room: room(p.device_id) } }, 100)
    progress(p, { stage: 'S6', step: 'gate', gate: p.gate, reason: p.gate === 'fail' ? 'person_in_work_area' : undefined })
    if (p.gate === 'fail') {
      result(p, { result: 'cancelled', channel: 'ARM', reason: 'person_in_work_area', explanation: `The ${name(p.device_id)} was not pressed because someone was near it. Nothing was tried again.` })
      continue
    }
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: p.device_id, step: 'press', room: room(p.device_id) } })
    progress(p, { stage: 'S6', step: 'press', channel: 'ARM' })
    for (const answer of p.checks ?? []) progress(p, { stage: 'S6', step: 'check', channel: 'ARM', answer })
    const why = p.wireless ? `${label(p.wireless.channel)} did not work` : 'it has no wireless channel'
    if (p.checks?.at(-1) === 'yes') result(p, { result: 'success', channel: 'ARM', explanation: `The robot pressed the ${name(p.device_id)} switch because ${why}. Checked: it is off.` })
    else result(p, { result: 'unsure', channel: 'ARM', explanation: `The robot pressed the ${name(p.device_id)} switch, but the camera could not tell whether it turned off. Nothing was pressed again.` })
  }
  emit({ kind: 'robot.status', data: { state: 'idle' } })
  return out
}

export function bedtimeScenario(now = () => new Date()): Timed[] {
  return playRuns({ trigger: 'time', runTrigger: 'time', summary: 'It is 23:00: the bedtime routine started.', routines: true }, BEDTIME, now)
}

/**
 * Try again, asked by the resident (C-09: never on its own). Same intent, same order: wireless
 * first if the device has a channel, then a press after a new safety gate. In the demo it works.
 */
export function retryScenario(run: Run, mappingId: string, now = () => new Date()): Timed[] {
  const wireless = device(run.device_id ?? '')?.channels?.find((c) => c !== 'ARM')
  const plan: Plan = {
    key: 'retry', device_id: run.device_id!, mapping_id: mappingId, intent: run.intent ?? `Operate the ${name(run.device_id!)}`,
    wireless: wireless ? { channel: wireless, works: false } : null, gate: 'pass', checks: ['yes'],
  }
  return playRuns({ trigger: 'resident', runTrigger: run.trigger, summary: `You asked to try again: ${plan.intent.toLowerCase()}.`, routines: false }, [plan], now)
}

/** A move order: the safety gate, then the move, for each stop. Nothing is pressed. */
export function routeScenario(routeId: string, stops: string[]): Timed[] {
  const out: Timed[] = []
  const emit = (event: LiveEvent, delayMs = STEP_MS) => out.push({ delayMs, event })
  emit({ kind: 'robot.route', data: { route_id: routeId, stops, reached: 0, state: 'moving' } }, 200)
  stops.forEach((id, i) => {
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: id, step: 'gate', room: room(id) } })
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: id, step: 'move', room: room(id) } })
    emit({ kind: 'robot.route', data: { route_id: routeId, stops, reached: i + 1, state: i + 1 === stops.length ? 'done' : 'moving' } }, 1500)
  })
  const last = stops.at(-1)
  emit({ kind: 'robot.status', data: { state: 'idle', device_id: last, room: last ? room(last) : undefined } })
  return out
}
