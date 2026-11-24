import type { Run } from '../api/client'
import type { Channel, LiveEvent, RunProgress } from '../api/proposed'

// One situation, played as live events with delays (the mock's stand-in for the hub).
// It shows every path the dashboard must handle:
//   Ceiling light  WIFI works                                   → success (S5)
//   Floor lamp     no wireless channel → press, check yes       → success (S6)
//   Air purifier   IR fails → press, check unsure twice         → unsure, never pressed again (C-09)
//   Heater         no wireless → safety gate fails              → cancelled (C-04), notified (C-03)
// Only Verified mappings are used (C-08). Tests in src/test/scenario.test.ts hold these rules.

export type Timed = { delayMs: number; event: LiveEvent }

const STEP_MS = 900 // pacing of the demo only, not a product value

type Plan = {
  key: string
  device_id: string
  mapping_id: string
  room: string
  intent: string
  wireless: { channel: Channel; works: boolean } | null
  gate?: 'pass' | 'fail'
  checks?: Array<'yes' | 'no' | 'unsure'>
}

const PLANS: Plan[] = [
  { key: 'ceiling', device_id: 'dev-ceiling', mapping_id: 'map-1', room: 'Room A', intent: 'Turn off the ceiling light', wireless: { channel: 'WIFI', works: true } },
  { key: 'floor', device_id: 'dev-floor', mapping_id: 'map-5', room: 'Room A', intent: 'Turn off the floor lamp', wireless: null, gate: 'pass', checks: ['yes'] },
  { key: 'purifier', device_id: 'dev-purifier', mapping_id: 'map-6', room: 'Room B', intent: 'Turn off the air purifier', wireless: { channel: 'IR', works: false }, gate: 'pass', checks: ['unsure', 'unsure'] },
  { key: 'heater', device_id: 'dev-heater', mapping_id: 'map-4', room: 'Room B', intent: 'Turn off the heater', wireless: null, gate: 'fail' },
]

let played = 0

export function bedtimeScenario(now = () => new Date()): Timed[] {
  const n = ++played
  const sid = `sit-${n}`
  const runId = (p: Plan) => `run-${n}-${p.key}`
  const out: Timed[] = []
  const emit = (event: LiveEvent, delayMs = STEP_MS) => out.push({ delayMs, event })
  const progress = (p: Plan, d: Omit<RunProgress, 'run_id' | 'situation_id' | 'device_id'>) =>
    emit({ kind: 'run.progress', data: { run_id: runId(p), situation_id: sid, device_id: p.device_id, ...d } })
  const result = (p: Plan, r: Pick<Run, 'result' | 'channel' | 'explanation'> & { reason?: string }) =>
    emit({
      kind: 'run.result',
      data: {
        run_id: runId(p), situation_id: sid, trigger: 'time', intent: p.intent, device_id: p.device_id,
        confidence: 0.9, started_at: now().toISOString(), ...r,
      },
    })

  emit({ kind: 'situation', data: { situation_id: sid, trigger: 'time', summary: 'It is 23:00: the bedtime routine started.', at: now().toISOString() } }, 300)

  for (const p of PLANS) {
    emit({ kind: 'routine', data: { routine_id: `rt-${n}-${p.key}`, situation_id: sid, mapping_id: p.mapping_id, action: 'off', time: '23:00', source: 'habit', independence: 'act_and_tell', priority: 1 } }, 400)
  }
  for (const p of PLANS) progress(p, { stage: 'S4', step: 'decide' })

  // S5: wireless first, for every device (C-09)
  const visits: Plan[] = []
  for (const p of PLANS) {
    if (!p.wireless) {
      progress(p, { stage: 'S5', step: 'wireless', wireless: 'no_wireless' })
      visits.push(p)
      continue
    }
    const { channel, works } = p.wireless
    progress(p, { stage: 'S5', step: 'check', channel, answer: works ? 'yes' : 'no' })
    progress(p, { stage: 'S5', step: 'wireless', channel, wireless: works ? 'success' : 'failure' })
    if (works) result(p, { result: 'success', channel, explanation: `At 23:00 the ${name(p)} was turned off over ${label(channel)}.` })
    else visits.push(p)
  }

  // S6: the robot visits what is left, in order, started by the system
  emit({ kind: 'robot.plan', data: { situation_id: sid, visits: visits.map((p) => ({ device_id: p.device_id, run_id: runId(p), why: p.wireless ? 'wireless_failed' : 'no_wireless' })) } })
  for (const p of visits) progress(p, { stage: 'S6', step: 'queued' })

  for (const p of visits) {
    // The run moves on first, then the robot reports it: the robot card never shows a step
    // older than the run's own.
    progress(p, { stage: 'S6', step: 'move' })
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: p.device_id, step: 'move', room: p.room } }, 100)
    progress(p, { stage: 'S6', step: 'gate', gate: p.gate, reason: p.gate === 'fail' ? 'person_in_work_area' : undefined })
    if (p.gate === 'fail') {
      result(p, { result: 'cancelled', channel: 'ARM', reason: 'person_in_work_area', explanation: `The ${name(p)} was not pressed because someone was near it. Nothing was tried again.` })
      emit({ kind: 'notification', data: { text: `The ${name(p)} is still on. Someone was near it, so the robot did not press.` } }, 200)
      continue
    }
    emit({ kind: 'robot.status', data: { state: 'busy', device_id: p.device_id, step: 'press', room: p.room } })
    progress(p, { stage: 'S6', step: 'press', channel: 'ARM' })
    for (const answer of p.checks ?? []) progress(p, { stage: 'S6', step: 'check', channel: 'ARM', answer })
    const last = p.checks?.at(-1)
    if (last === 'yes') result(p, { result: 'success', channel: 'ARM', explanation: `The ${name(p)} has no wireless channel, so the robot pressed its switch. Checked: it is off.` })
    else result(p, { result: 'unsure', channel: 'ARM', explanation: `The robot pressed the ${name(p)} switch, but the camera could not tell whether it turned off. Nothing was pressed again.` })
  }
  emit({ kind: 'robot.status', data: { state: 'idle' } })
  return out
}

const NAMES: Record<string, string> = {
  'dev-ceiling': 'ceiling light', 'dev-floor': 'floor lamp', 'dev-purifier': 'air purifier', 'dev-heater': 'heater',
}
const name = (p: Plan) => NAMES[p.device_id] ?? p.device_id
const label = (c: Channel) => ({ IR: 'IR', WIFI: 'Wi-Fi', BT: 'Bluetooth', ARM: 'a press' })[c]
