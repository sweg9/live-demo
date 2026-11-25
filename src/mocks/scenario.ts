import type { Run } from '../api/client'
import {
  DOCK,
  type Channel,
  type LiveEvent,
  type Notification,
  type PlanItem,
  type Robot,
  type RobotRoute,
  type RunProgress,
  type Situation,
  type Step,
  type Visit,
} from '../api/proposed'
import { IDLE_ROBOT } from '../live/live'
import { devices, mappings } from './fixtures'
import { layout } from './layout'

// Live events the mock plays with delays: its stand-in for the hub. Same kinds, shapes, texts
// and order as backend-server's orchestrator (src/backend/hub/orchestrator.py, spec 0.5.0): a
// situation grows its plan, wireless goes first, then the visit list, then the robot visits and
// presses, then it goes back to the dock. A run's run.progress comes before the robot event of
// the same step. Tests in src/test/scenario.test.ts hold every scenario to C-03, C-04, C-08 and
// C-09.
//
// The bedtime scenario shows every path the dashboard must handle:
//   Ceiling light  WIFI works                                   → success (S5)
//   Floor lamp     no wireless → press, no change → gate, press again, yes → success (FR-11)
//   Air purifier   IR fails → press, unsure, one more look      → unsure, never pressed again (C-09)
//   Heater         no wireless → safety gate fails              → cancelled (C-04), notified (C-03)

export type Timed = { delayMs: number; event: LiveEvent }

const STEP_MS = 900 // pacing of the demo only, not a product value
const MAX_PRESSES = 2 // mirrors the hub's MAX_ARM_ATTEMPTS (FR-11, L-04)
const MOVE_MS = 1500

export const EMERGENCY = 'emergency stop'
export const PERSON = 'a person was in the work area'

export type Plan = {
  key: string
  device_id: string
  action: 'on' | 'off'
  decision?: PlanItem['decision'] // act unless said
  routine?: boolean
  wireless: { channel: Exclude<Channel, 'ARM'>; works: boolean } | null
  gate?: 'pass' | 'fail'
  secondGate?: 'pass' | 'fail' // before a second press
  /** The camera's answers in order: one per check, plus one more look after an unsure (FR-08). */
  checks?: Array<'yes' | 'no' | 'unsure'>
}

const BEDTIME: Plan[] = [
  { key: 'ceiling', device_id: 'dev-ceiling', action: 'off', routine: true, wireless: { channel: 'WIFI', works: true } },
  { key: 'floor', device_id: 'dev-floor', action: 'off', wireless: null, gate: 'pass', checks: ['no', 'yes'] },
  { key: 'purifier', device_id: 'dev-purifier', action: 'off', wireless: { channel: 'IR', works: false }, gate: 'pass', checks: ['unsure', 'unsure'] },
  { key: 'heater', device_id: 'dev-heater', action: 'off', routine: true, wireless: null, gate: 'fail' },
]

let played = 0
const device = (id: string) => devices.find((d) => d.device_id === id)!
const lower = (id: string) => device(id).name.toLowerCase()
const verified = (deviceId: string) => mappings.find((m) => m.device_id === deviceId && m.status === 'Verified')
export const controlOf = (deviceId: string) => layout.controls.find((c) => c.control_id === verified(deviceId)?.control_id)
const CHANNEL_WORDS: Record<Channel, string> = { IR: 'IR', WIFI: 'Wi-Fi', BT: 'Bluetooth', ARM: 'pressing its switch' }

type Outcome = Pick<RunProgress, 'wireless' | 'gate' | 'answer' | 'reason'>
type Open = { item: PlanItem; plan: Plan; retryOf: string | null }

/** Builds a timed list of events and keeps the robot as the hub would. */
class Player {
  out: Timed[] = []
  robot: Robot
  visits: Visit[] = []
  constructor(
    readonly now: () => Date,
    from: Robot,
    readonly sit: Situation | null,
    readonly trigger: Run['trigger'],
  ) {
    this.robot = structuredClone(from)
  }

  emit(event: LiveEvent, delayMs = STEP_MS) {
    this.out.push({ delayMs, event: structuredClone(event) })
  }
  notify(n: Omit<Notification, 'at'>, delayMs = 200) {
    this.emit({ kind: 'notification', data: { ...n, at: this.now().toISOString() } }, delayMs)
  }
  emitRobot(delayMs = 100) {
    this.emit({ kind: 'robot', data: this.robot }, delayMs)
  }
  emitVisits(delayMs = 100) {
    this.emit({ kind: 'visits', data: { visits: this.visits } }, delayMs)
  }
  emitSit(delayMs = STEP_MS) {
    if (this.sit) this.emit({ kind: 'situation', data: this.sit }, delayMs)
  }
  /** The hub's progress: one run.progress. */
  progress(r: Open, step: Step, text: string, stage: RunProgress['stage'], channel: Channel | null = null, outcome: Outcome = {}) {
    const method = channel === null ? null : channel === 'ARM' ? 'press' : 'wireless'
    this.emit({
      kind: 'run.progress',
      data: { run_id: r.item.run_id!, situation_id: this.sit?.situation_id ?? null, device_id: r.item.device_id, stage, step, text, method, channel, ...outcome },
    })
  }
  /** The hub's set_task: the run's progress first, then the robot with the same task. */
  task(r: Open | null, step: Step, text: string, stage: RunProgress['stage'] | null = null, channel: Channel | null = null) {
    const method = channel === null ? null : channel === 'ARM' ? 'press' : 'wireless'
    this.robot.task = { run_id: r?.item.run_id ?? null, device_id: r?.item.device_id ?? null, stage, step, text, method, channel }
    if (r && stage) this.progress(r, step, text, stage, channel)
    this.emitRobot()
  }
  moveTo(spot: string) {
    if (this.robot.spot_id === spot) return
    this.robot.state = 'moving'
    this.robot.ral.state = 'busy'
    this.emitRobot()
    this.robot.spot_id = spot
    this.emitRobot(MOVE_MS)
  }
  idle() {
    this.robot.task = null
    this.robot.plan = []
    this.robot.state = 'idle'
    this.robot.ral.state = 'idle'
  }
  goHome() {
    this.robot.task = null
    this.robot.plan = []
    this.moveTo(DOCK)
    this.idle()
    this.emitRobot()
  }

  /** The hub's close: the plan item, the situation, run.result, then the notification (C-03, C-09). */
  close(r: Open, result: Run['result'], reason?: string) {
    const { item } = r
    if (result !== 'success' && !reason) reason = { failure: 'the check saw no change', unsure: 'the check could not tell' }[result as string] ?? EMERGENCY
    const channel: Channel | undefined = result === 'cancelled' && reason !== EMERGENCY ? undefined : item.method === 'press' ? 'ARM' : item.wireless.channel ?? undefined
    const name = lower(item.device_id)
    const how = channel ? ` by ${CHANNEL_WORDS[channel]}` : ''
    const asked = r.retryOf ? ' because you asked me to try again' : ''
    const explanation = {
      success: `I switched ${item.action} the ${name}${how}${asked}. Checked: it worked.`,
      failure: `I tried to switch ${item.action} the ${name}${how}${asked}. Checked: it did not work (${reason}).`,
      unsure: `I tried to switch ${item.action} the ${name}${how}${asked}. Checked: I could not tell if it worked (${reason}). I did not press again.`,
      cancelled: `I did not switch ${item.action} the ${name}: ${reason}. Nothing was changed.`,
    }[result]
    item.result = result
    item.reason = result === 'success' ? null : reason!
    this.emitSit(100)
    const sid = this.sit?.situation_id ?? null
    this.emit({
      kind: 'run.result',
      data: {
        run_id: item.run_id!, trigger: this.trigger, situation_id: sid, intent: `turn ${item.action} the ${name}`, device_id: item.device_id,
        confidence: item.confidence, channel, result, reason: item.reason ?? undefined, explanation,
        started_at: this.now().toISOString(), resolution: null, retry_of: r.retryOf,
      },
    }, 100)
    const about = { run_id: item.run_id!, device_id: item.device_id, situation_id: sid }
    if (result === 'failure' || result === 'unsure') {
      this.notify({ level: 'warning', topic: 'run_failed', message: explanation, choices: ['retry', 'leave'], ...about })
    } else if (item.risk === 'high') {
      this.notify({ level: result === 'cancelled' ? 'warning' : 'info', topic: 'high_risk_run', message: explanation, ...about })
    }
  }

  /** The hub's press_visit: drive, safety gate, press, camera check, one more look if unsure. */
  pressVisit(v: Visit, r: Open) {
    const status = (s: Visit['status']) => {
      v.status = s
      this.emitVisits()
    }
    status('moving')
    this.task(r, 'move', 'drive to the switch', 'S6', 'ARM')
    this.moveTo(v.spot_id)
    if (this.robot.plan[0] === v.spot_id) this.robot.plan.shift()
    // FR-11: a failed check (`no`) leads to one more press after a new gate, at most MAX_PRESSES (L-04).
    // `unsure` is looked at once more and never pressed again (FR-08, C-09).
    const answers = [...(r.plan.checks ?? ['yes'])]
    const unclear = `the camera could not tell whether the ${lower(r.item.device_id)} changed`
    let answer: 'yes' | 'no' | 'unsure' = 'yes'
    let presses = 0
    for (let n = 1; n <= MAX_PRESSES; n++) {
      const again = n > 1
      status('pressing')
      this.robot.state = 'pressing'
      this.task(r, 'gate', again ? 'safety gate before the second press' : 'safety gate: no person in the work area', 'S6', 'ARM')
      const ok = (again ? r.plan.secondGate : r.plan.gate) !== 'fail'
      this.progress(r, 'gate', ok ? 'safety gate passed' : `safety gate failed: ${PERSON}`, 'S6', 'ARM', { gate: ok ? 'pass' : 'fail', reason: ok ? null : PERSON })
      if (!ok) {
        // C-04: no press
        this.close(r, 'cancelled', PERSON)
        status('cancelled')
        return
      }
      this.task(r, 'press', again ? 'press again' : 'press', 'S6', 'ARM')
      presses = n
      this.robot.state = 'checking'
      status('checking')
      this.task(r, 'check', 'check the effect with the camera', 'S6', 'ARM')
      answer = answers.shift() ?? 'yes'
      const wasUnsure = answer === 'unsure'
      if (wasUnsure) {
        this.progress(r, 'check', 'unsure', 'S6', 'ARM', { answer, reason: unclear })
        this.task(r, 'check', 'unsure: look once more without pressing again', 'S6', 'ARM')
        answer = answers.shift() ?? 'unsure'
      }
      // FR-11, C-09: after an unsure check there is no second press, even when the second look says no
      const more = answer === 'no' && n < MAX_PRESSES && !wasUnsure
      const said = { yes: 'it worked', no: more ? 'it did not work: press once more' : 'it did not work', unsure: 'still unsure' }[answer]
      this.progress(r, 'check', said, 'S6', 'ARM', { answer, reason: answer === 'yes' ? null : answer === 'no' ? 'the check saw no change' : unclear })
      if (!more) break
    }
    const result = answer === 'yes' ? 'success' : answer === 'no' ? 'failure' : 'unsure'
    const why = answer === 'yes' ? undefined : answer === 'no' ? `${presses > 1 ? 'pressed twice: ' : ''}the check saw no change` : unclear
    this.close(r, result, why)
    status(result === 'success' ? 'done' : 'failed')
  }

  visitFor(r: Open, n: number, k: number, reason: Visit['reason']): Visit {
    const c = controlOf(r.item.device_id)!
    return {
      visit_id: `vis-${n}-${r.plan.key}`, order: k + 1, situation_id: this.sit?.situation_id ?? null, spot_id: c.spot_id,
      control_id: c.control_id, device_id: r.item.device_id, run_id: r.item.run_id!, reason, status: 'waiting',
    }
  }
}

function planItem(plan: Plan): PlanItem {
  const d = device(plan.device_id)
  const m = verified(plan.device_id)!
  return {
    device_id: d.device_id, name: d.name, room: d.room, risk: d.risk, mapping_id: m.mapping_id,
    routine_id: plan.routine ? `rt-${plan.key}` : null, action: plan.action, decision: plan.decision ?? 'act',
    confidence: m.confidence, method: plan.wireless ? 'wireless' : 'press',
    wireless: plan.wireless ? { channel: plan.wireless.channel, result: 'pending', reason: null } : { channel: null, result: 'no_channel', reason: null },
    run_id: null, result: null, reason: null, resolution: null,
  }
}

const settled = (sit: Situation) => sit.plan.every((i) => i.result === null || i.result === 'success' || i.resolution === 'leave')

export type Played = {
  events: Timed[]
  situationId: string
  /** Set while the situation waits for the resident's answer (FR-06): the rest of the play. */
  answer?: (yes: boolean) => Timed[]
}

/** One situation: the plan, device by device; wireless first (S5); then the robot (S6). */
export function playSituation(
  s: { kind: string; trigger: Situation['trigger']; summary: string },
  plans: Plan[],
  now = () => new Date(),
  from: Robot = IDLE_ROBOT,
): Played {
  const n = ++played
  const sit: Situation = { situation_id: `sit-${n}`, kind: s.kind, trigger: s.trigger, summary: s.summary, received_at: now().toISOString(), status: 'received', plan: [] }
  const p = new Player(now, from, sit, s.trigger)
  const sid = sit.situation_id

  p.emitSit(300)
  p.notify({ level: 'info', topic: 'situation', message: s.summary, situation_id: sid }, 50)
  sit.status = 'planning'
  p.emitSit()
  for (const plan of plans) {
    sit.plan.push(planItem(plan))
    p.emitSit(400)
  }
  if (sit.plan.every((i) => i.decision === 'suggest')) {
    sit.status = 'suggested'
    p.emitSit()
    p.notify({ level: 'info', topic: 'suggestion', message: `I only suggest this time: ${s.summary}`, situation_id: sid })
    return { events: p.out, situationId: sid }
  }
  if (sit.plan.some((i) => i.decision === 'ask')) {
    sit.status = 'waiting_for_answer'
    p.emitSit()
    p.notify({ level: 'info', topic: 'question', message: `Shall I go ahead? ${s.summary}`, situation_id: sid, choices: ['approve', 'dismiss'] })
    return {
      events: p.out,
      situationId: sid,
      answer: (yes) => {
        p.out = []
        if (!yes) {
          sit.status = 'dismissed'
          p.emitSit(100)
          return p.out
        }
        sit.plan.forEach((i) => i.decision === 'ask' && (i.decision = 'act'))
        run(p, plans, n)
        return p.out
      },
    }
  }
  run(p, plans, n)
  return { events: p.out, situationId: sid }
}

function run(p: Player, plans: Plan[], n: number) {
  const sit = p.sit!
  sit.status = 'running'
  const open: Open[] = sit.plan.flatMap((item, k) => (item.decision === 'act' ? [{ item, plan: plans[k], retryOf: null }] : []))
  open.forEach((r) => (r.item.run_id = `run-${n}-${r.plan.key}`))
  p.emitSit()
  for (const r of open) p.progress(r, 'decide', 'decided to act', 'S4')

  // S5: wireless first, in the order of the plan (C-09)
  for (const r of open) {
    const w = r.plan.wireless
    if (!w) continue
    p.task(r, 'wireless', `send over ${w.channel}`, 'S5', w.channel)
    const why = w.works ? null : `no answer over ${w.channel}`
    r.item.wireless.result = w.works ? 'success' : 'failure'
    p.progress(r, 'wireless', `${w.channel}: ${w.works ? 'it worked' : 'it did not work'}`, 'S5', w.channel, {
      wireless: r.item.wireless.result, answer: w.works ? 'yes' : 'no', reason: why,
    })
    if (w.works) {
      p.close(r, 'success')
    } else {
      r.item.wireless.reason = why
      r.item.method = 'press'
      p.emitSit()
    }
  }

  // S6: the visit list for what wireless could not do, then the robot goes on its own
  const todo = open.filter((r) => r.item.result === null)
  if (todo.length) {
    todo.forEach((r, k) => {
      const none = r.item.wireless.result === 'no_channel'
      if (none) p.progress(r, 'wireless', 'no wireless channel', 'S5', null, { wireless: 'no_channel' })
      p.visits.push(p.visitFor(r, n, k, none ? 'no_channel' : 'wireless_failed'))
      p.progress(r, 'queued', 'waits for the robot', 'S6', 'ARM')
    })
    p.robot.plan = p.visits.map((v) => v.spot_id)
    p.emitVisits(STEP_MS)
    p.emitRobot()
    for (const v of p.visits) p.pressVisit(v, todo.find((r) => r.item.run_id === v.run_id)!)
    p.goHome()
  }
  sit.status = settled(sit) ? 'done' : 'needs_attention'
  p.emitSit()
}

export function bedtimeScenario(now = () => new Date(), from: Robot = IDLE_ROBOT): Timed[] {
  return playSituation({ kind: 'bedtime', trigger: 'time', summary: 'It is 23:00: the bedtime routine started.' }, BEDTIME, now, from).events
}

/** A bedtime that asks first (FR-06): the heater is high risk, so the hub waits for an answer. */
export function askingScenario(now = () => new Date(), from: Robot = IDLE_ROBOT): Played {
  const plans = BEDTIME.map((x) => (x.key === 'heater' ? { ...x, decision: 'ask' as const, gate: 'pass' as const, checks: ['yes' as const] } : x))
  return playSituation({ kind: 'bedtime', trigger: 'time', summary: 'It is 23:00: the bedtime routine started.' }, plans, now, from)
}

/** The new run's id for a retry, so the answer can name it before the play starts. */
export const retryRunId = () => `run-${++played}-retry`

/**
 * Try again, asked by the resident (C-09: never on its own). Like the hub: a new run with the
 * same trigger and `retry_of`, a visit "requested", a press after a new safety gate. In the demo
 * it works. `sit` is the situation the run came from, if any: its plan item takes the new run.
 */
export function retryScenario(run: Run, newRunId: string, sit: Situation | null, now = () => new Date(), from: Robot = IDLE_ROBOT): Timed[] {
  const copy = sit ? structuredClone(sit) : null
  const p = new Player(now, from, copy, run.trigger)
  const plan: Plan = { key: 'retry', device_id: run.device_id!, action: run.intent?.includes(' on ') ? 'on' : 'off', wireless: null, gate: 'pass', checks: ['yes'] }
  let item = copy?.plan.find((i) => i.run_id === run.run_id)
  if (copy && item) {
    Object.assign(item, { run_id: newRunId, result: null, reason: null, resolution: 'retry', method: 'press' })
    copy.status = 'running'
    p.emitSit(200)
  } else {
    item = { ...planItem(plan), run_id: newRunId, method: 'press' }
  }
  const r: Open = { item, plan, retryOf: run.run_id }
  p.progress(r, 'decide', 'you asked to try again', 'S4')
  const v = p.visitFor(r, 0, 0, 'requested')
  v.visit_id = `vis-${newRunId}`
  p.visits = [v]
  p.robot.plan = [v.spot_id]
  p.emitVisits(200)
  p.progress(r, 'queued', 'waits for the robot', 'S6', 'ARM')
  p.pressVisit(v, r)
  p.goHome()
  if (copy) {
    copy.status = settled(copy) ? 'done' : 'needs_attention'
    p.emitSit()
  }
  return p.out
}

/**
 * A move order (POST /robot/route): the safety gate before every leg, then the move (C-04).
 * Nothing is pressed. `gateFails` is the index of a stop whose way is blocked, for tests.
 */
export function routeScenario(routeId: string, spots: string[], now = () => new Date(), from: Robot = IDLE_ROBOT, gateFails = -1): Timed[] {
  const p = new Player(now, from, null, 'routine')
  const order: RobotRoute = { route_id: routeId, stops: [...spots], reached: 0, state: 'moving', reason: null }
  const emitRoute = (delayMs = 100) => p.emit({ kind: 'robot.route', data: order }, delayMs)
  emitRoute(200)
  p.robot.plan = [...spots]
  for (const [k, spot] of spots.entries()) {
    p.task(null, 'gate', `safety gate: nobody on the way to ${spot}`)
    if (k === gateFails) {
      order.state = 'cancelled'
      order.reason = `safety gate failed: ${PERSON}`
      p.idle()
      emitRoute()
      p.emitRobot()
      p.notify({ level: 'warning', topic: 'route_cancelled', message: `I did not move: ${PERSON}.`, route_id: routeId })
      return p.out
    }
    p.task(null, 'move', `go to ${spot}`)
    p.moveTo(spot)
    if (p.robot.plan[0] === spot) p.robot.plan.shift()
    order.reached++
    emitRoute()
  }
  order.state = 'done'
  p.idle()
  emitRoute()
  p.emitRobot()
  return p.out
}
