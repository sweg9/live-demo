import type { Run } from '../api/client'
import { DOCK, type Choice, type LiveEvent, type Robot, type RobotRoute, type Situation, type Visit } from '../api/proposed'
import { IDLE_ROBOT, isBusy } from '../live/live'
import * as fx from './fixtures'
import { layout } from './layout'
import { bedtimeScenario, EMERGENCY, retryRunId, retryScenario, routeScenario, type Played, type Timed } from './scenario'

// The mock's stand-in for the hub at home: it holds the records and plays live events, like
// backend-server's orchestrator. One task at a time, like one robot in one home. Kept in
// memory: a reload starts again.

export const DEMO_PASSWORD = 'nova-demo' // mock only; the real password is checked by the hub
const LOGIN_MAX_FAILURES = 5 // mirrors settings/server.yaml of backend-server
const LOGIN_WINDOW_MS = 60_000
const ACTIVE: Situation['status'][] = ['received', 'planning', 'waiting_for_answer', 'running']
const AT_WORK: Visit['status'][] = ['waiting', 'moving', 'pressing', 'checking']

type Send = (event: LiveEvent) => void
type Reply = { status: number; body?: unknown }

function fresh() {
  return {
    mappings: structuredClone(fx.mappings),
    runs: structuredClone(fx.runs) as Run[], // with the resident's choice in `resolution`, like the hub
    situations: new Map<string, Situation>(),
    visits: [] as Visit[],
    robot: structuredClone(IDLE_ROBOT) as Robot,
    route: null as RobotRoute | null,
    paused: false,
    signedIn: true, // the demo starts signed in; Sign out shows the sign-in screen
    failures: [] as number[],
    active: new Map<string, { device_id: string; situation_id: string | null }>(), // runs without a result
    waiting: new Map<string, (yes: boolean) => Timed[]>(), // situations waiting for an answer
    routes: 0,
  }
}

export const hub = {
  state: fresh(),
  send: null as Send | null,
  closeLive: null as null | (() => void),
  timers: [] as ReturnType<typeof setTimeout>[],

  reset() {
    this.cancel()
    this.state = fresh()
    this.send = null
    this.closeLive = null
  },

  cancel() {
    this.timers.forEach(clearTimeout)
    this.timers = []
  },

  /** Plays events in order. Keeps the records and the robot in step with what it sends. */
  play(events: Timed[]) {
    this.cancel()
    let at = 0
    for (const { delayMs, event } of events) {
      at += delayMs
      this.timers.push(setTimeout(() => this.emit(event), at))
    }
  },

  emit(event: LiveEvent) {
    const s = this.state
    switch (event.kind) {
      case 'run.progress':
        s.active.set(event.data.run_id, { device_id: event.data.device_id, situation_id: event.data.situation_id })
        break
      case 'run.result':
        s.active.delete(event.data.run_id)
        if (!s.runs.some((r) => r.run_id === event.data.run_id)) s.runs.unshift(event.data)
        break
      case 'situation':
        s.situations.set(event.data.situation_id, structuredClone(event.data))
        break
      case 'visits':
        s.visits = structuredClone(event.data.visits)
        break
      case 'robot':
        s.robot = structuredClone(event.data)
        break
      case 'robot.route':
        s.route = structuredClone(event.data)
        break
    }
    this.send?.(event)
  },

  start(played: Played) {
    this.play(played.events)
    if (played.answer) this.state.waiting.set(played.situationId, played.answer)
  },

  bedtime() {
    if (isBusy(this.state.robot)) return
    this.play(bedtimeScenario(undefined, this.state.robot))
  },

  situationOf(runId: string) {
    return [...this.state.situations.values()].find((x) => x.plan.some((i) => i.run_id === runId)) ?? null
  },

  /** Emergency stop: the hand first; then the open runs, the visits, the situations (C-04, C-09). */
  stop() {
    this.cancel()
    const s = this.state
    s.robot = { ...s.robot, state: 'stopped', task: null, plan: [], ral: { ...s.robot.ral, state: 'stopped' } }
    s.waiting.clear()
    const now = new Date().toISOString()
    for (const [run_id, r] of s.active) {
      const sit = r.situation_id ? s.situations.get(r.situation_id) : undefined
      const item = sit?.plan.find((i) => i.run_id === run_id)
      if (sit && item) {
        Object.assign(item, { result: 'cancelled', reason: EMERGENCY })
        this.emit({ kind: 'situation', data: sit })
      }
      this.emit({
        kind: 'run.result',
        data: {
          run_id, device_id: r.device_id, situation_id: r.situation_id, trigger: sit?.trigger ?? 'routine', started_at: now,
          result: 'cancelled', reason: EMERGENCY, resolution: null, retry_of: null,
          explanation: 'Stopped by the emergency stop. Nothing will be tried again until you ask.',
        },
      })
    }
    s.visits.forEach((v) => AT_WORK.includes(v.status) && (v.status = 'cancelled'))
    for (const sit of s.situations.values()) {
      if (ACTIVE.includes(sit.status)) this.emit({ kind: 'situation', data: { ...sit, status: 'cancelled' } })
    }
    if (s.route?.state === 'moving') this.emit({ kind: 'robot.route', data: { ...s.route, state: 'cancelled', reason: EMERGENCY } })
    this.emit({ kind: 'visits', data: { visits: s.visits } })
    this.emit({ kind: 'robot', data: s.robot })
    this.emit({ kind: 'notification', data: { level: 'warning', topic: 'stop', message: 'Emergency stop: the hand stopped and the current run was cancelled.', at: now } })
  },

  /** The checks the hub makes before a retry or a leave (backend-server hub/app.py). */
  chooseable(runId: string): Reply | Run {
    const run = this.state.runs.find((r) => r.run_id === runId)
    if (!run) return err(404, 'not_found', 'Unknown id')
    if (run.result === 'success') return err(409, 'not_failed', 'This run succeeded')
    if (run.resolution) return err(409, 'already_chosen', 'The resident already chose for this run')
    return run
  },

  retry(runId: string): Reply {
    const run = this.chooseable(runId)
    if ('status' in run) return run
    if (isBusy(this.state.robot)) return err(409, 'robot_busy', 'The robot is busy. Try again when it is idle.')
    if (!this.state.mappings.some((m) => m.device_id === run.device_id && m.status === 'Verified')) {
      return err(409, 'not_verified', 'The switch for this device is not Verified, so the robot cannot use it (C-08)')
    }
    const retry_run_id = retryRunId()
    run.resolution = { choice: 'retry', retry_run_id }
    this.play(retryScenario(run, retry_run_id, this.situationOf(runId), undefined, this.state.robot))
    return { status: 202, body: { run_id: runId, choice: 'retry', retry_run_id } satisfies Choice }
  },

  leave(runId: string): Reply {
    const run = this.chooseable(runId)
    if ('status' in run) return run
    run.resolution = { choice: 'leave', retry_run_id: null }
    const sit = this.situationOf(runId)
    if (sit) {
      sit.plan.forEach((i) => i.run_id === runId && (i.resolution = 'leave'))
      if (sit.status === 'needs_attention' && sit.plan.every((i) => i.result === null || i.result === 'success' || i.resolution === 'leave')) sit.status = 'done'
      this.emit({ kind: 'situation', data: sit })
    }
    this.emit({ kind: 'notification', data: { level: 'info', topic: 'left_as_is', message: `Left as it is: ${run.intent}.`, at: new Date().toISOString(), run_id: runId } })
    return { status: 200, body: { run_id: runId, choice: 'leave', retry_run_id: null } satisfies Choice }
  },

  answer(situationId: string, yes: boolean): Reply {
    const go = this.state.waiting.get(situationId)
    const sit = this.state.situations.get(situationId)
    if (!go && !sit) return err(404, 'not_found', 'Unknown id')
    if (!go) return err(409, 'not_waiting', 'This situation does not wait for an answer')
    this.state.waiting.delete(situationId)
    const rest = go(yes)
    this.play(rest)
    const now = rest.find((t) => t.event.kind === 'situation')?.event.data as Situation
    return { status: 200, body: now }
  },

  /** POST /robot/route: each stop is a spot, a control or a device (the press spot of its Verified control). */
  route(stops: unknown): Reply {
    if (!Array.isArray(stops) || stops.length === 0) return err(400, 'no_stops', 'Pick at least one place')
    if (isBusy(this.state.robot)) return err(409, 'robot_busy', 'The robot is busy. Try again when it is idle.')
    const spots: string[] = []
    for (const id of stops as string[]) {
      const control = layout.controls.find((c) => c.spot_id === id || c.control_id === id)
      const device = fx.devices.find((d) => d.device_id === id)
      if (id === DOCK || control) {
        spots.push(id === DOCK ? DOCK : control!.spot_id)
        continue
      }
      if (!device) return err(404, 'unknown_stop', `Unknown place: ${id}`)
      const m = this.state.mappings.find((x) => x.device_id === id && x.status === 'Verified')
      if (!m) return err(409, 'not_verified', `No Verified switch for ${device.name}, so there is no spot to go to (C-08)`)
      const spot = layout.controls.find((c) => c.control_id === m.control_id)?.spot_id
      if (!spot) return err(409, 'no_press_spot', `The switch for ${device.name} has no press spot yet`)
      spots.push(spot)
    }
    const route_id = `route-${++this.state.routes}`
    this.play(routeScenario(route_id, spots, undefined, this.state.robot))
    return { status: 202, body: { route_id, stops: spots } }
  },

  login(password: string): Reply {
    const now = Date.now()
    const s = this.state
    s.failures = s.failures.filter((t) => now - t < LOGIN_WINDOW_MS)
    if (s.failures.length >= LOGIN_MAX_FAILURES) return err(429, 'too_many_tries', 'Too many wrong passwords; try again in a minute')
    if (password !== DEMO_PASSWORD) {
      s.failures.push(now)
      return err(401, 'wrong_password', 'Wrong password')
    }
    s.failures = []
    s.signedIn = true
    return { status: 204 }
  },
}

function err(status: number, code: string, message: string): Reply {
  return { status, body: { code, message } }
}
