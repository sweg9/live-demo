import type { Run } from '../api/client'
import type { LiveEvent, RunWithResolution } from '../api/proposed'
import * as fx from './fixtures'
import { bedtimeScenario, retryScenario, routeScenario, type Timed } from './scenario'

// The mock's stand-in for the hub at home: it holds the records and plays live events. One
// playback at a time, like one robot in one home. Kept in memory: a reload starts again.

export const DEMO_PASSWORD = 'nova-demo' // mock only; the real password is checked by the hub
const LOGIN_MAX_FAILURES = 5 // mirrors settings/server.yaml of backend-server
const LOGIN_WINDOW_MS = 60_000

type Send = (event: LiveEvent) => void

function fresh() {
  return {
    mappings: structuredClone(fx.mappings),
    runs: structuredClone(fx.runs) as RunWithResolution[],
    paused: false,
    signedIn: true, // the demo starts signed in; Sign out shows the sign-in screen
    failures: [] as number[],
    robot: 'idle' as 'idle' | 'busy' | 'stopped',
    active: new Map<string, { device_id: string; situation_id: string }>(), // runs without a result
    route: null as null | { route_id: string; stops: string[]; reached: number },
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

  /** Plays events in order. Keeps the records and the robot state in step with what it sends. */
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
    if (event.kind === 'run.progress') s.active.set(event.data.run_id, { device_id: event.data.device_id, situation_id: event.data.situation_id })
    if (event.kind === 'run.result') {
      s.active.delete(event.data.run_id)
      if (!s.runs.some((r) => r.run_id === event.data.run_id)) s.runs.unshift(event.data)
    }
    if (event.kind === 'robot.status') s.robot = event.data.state === 'busy' ? 'busy' : event.data.state === 'stopped' ? 'stopped' : 'idle'
    if (event.kind === 'robot.route') s.route = event.data.state === 'moving' ? event.data : null
    this.send?.(event)
  },

  bedtime() {
    this.play(bedtimeScenario())
  },

  /** Emergency stop: stop the hand, end every open run as cancelled (C-04, C-09). */
  stop() {
    this.cancel()
    const now = new Date().toISOString()
    for (const [run_id, r] of this.state.active) {
      this.emit({
        kind: 'run.result',
        data: {
          run_id, situation_id: r.situation_id, device_id: r.device_id, trigger: 'routine', started_at: now,
          result: 'cancelled', channel: 'ARM', reason: 'emergency stop',
          explanation: 'Stopped by the emergency stop. Nothing will be tried again until you ask.',
        },
      })
    }
    if (this.state.route) {
      this.emit({ kind: 'robot.route', data: { ...this.state.route, state: 'cancelled', reason: 'emergency stop' } })
    }
    this.emit({ kind: 'robot.status', data: { state: 'stopped' } })
  },

  retry(runId: string): { status: number; body: unknown } {
    const run = this.state.runs.find((r) => r.run_id === runId)
    if (!run) return err(404, 'not_found', 'No such run')
    if (run.result === 'success') return err(409, 'nothing_to_retry', 'This run succeeded')
    if (run.resolution) return err(409, 'already_resolved', `You already chose: ${run.resolution}`)
    if (this.state.robot === 'busy') return err(409, 'robot_busy', 'The robot is busy. Try again when it is idle.')
    const mapping = this.state.mappings.find((m) => m.device_id === run.device_id && m.status === 'Verified')
    if (!mapping) return err(409, 'mapping_not_verified', 'The switch for this device is not Verified yet, so the robot cannot use it (C-08)')
    run.resolution = 'retried'
    const events = retryScenario(run as Run, mapping.mapping_id)
    this.play(events)
    const first = events.find((e) => e.event.kind === 'run.progress')!.event as Extract<LiveEvent, { kind: 'run.progress' }>
    return { status: 202, body: { run_id: runId, retry_run_id: first.data.run_id } }
  },

  leave(runId: string): { status: number; body: unknown } {
    const run = this.state.runs.find((r) => r.run_id === runId)
    if (!run) return err(404, 'not_found', 'No such run')
    if (run.result === 'success') return err(409, 'nothing_to_leave', 'This run succeeded')
    if (run.resolution) return err(409, 'already_resolved', `You already chose: ${run.resolution}`)
    run.resolution = 'left'
    return { status: 200, body: run }
  },

  route(stops: string[]): { status: number; body: unknown } {
    if (!Array.isArray(stops) || stops.length === 0) return err(400, 'no_stops', 'Pick at least one place')
    if (this.state.robot === 'busy') return err(409, 'robot_busy', 'The robot is busy. Try again when it is idle.')
    for (const id of stops) {
      if (!this.state.mappings.some((m) => m.device_id === id && m.status === 'Verified')) {
        return err(409, 'mapping_not_verified', `No Verified switch for ${id}, so there is no spot to go to (C-08)`)
      }
    }
    const route_id = `route-${++this.state.routes}`
    this.play(routeScenario(route_id, stops))
    return { status: 202, body: { route_id } }
  },

  login(password: string): { status: number; body?: unknown } {
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

function err(status: number, code: string, message: string) {
  return { status, body: { code, message } }
}
