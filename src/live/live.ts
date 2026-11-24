import type { Routine, Run } from '../api/client'
import type { LiveEvent, RobotRoute, RobotStatus, RunProgress, Situation, Visit } from '../api/proposed'

// Everything the live screens know, built only from WebSocket events. The server keeps nothing,
// so after a reconnect the lists are read again over HTTP (wiki: Hub messages > app.event).

export type DeviceRun = {
  run_id: string
  device_id: string
  situation_id: string
  steps: RunProgress[]
  wireless?: RunProgress['wireless']
  result?: Run
}

export type LiveState = {
  connected: boolean
  situations: Situation[] // newest first
  routines: Record<string, Routine[]> // by situation_id
  runs: Record<string, DeviceRun> // by run_id
  plans: Record<string, Visit[]> // by situation_id
  robot: RobotStatus
  route: RobotRoute | null // the newest move order
  notifications: string[] // newest first
}

const KEEP_SITUATIONS = 10 // screen memory only

export const initialLive: LiveState = {
  connected: false,
  situations: [],
  routines: {},
  runs: {},
  plans: {},
  robot: { state: 'idle' },
  route: null,
  notifications: [],
}

export type LiveAction = { type: 'event'; event: LiveEvent } | { type: 'connected'; value: boolean }

export function reduce(s: LiveState, a: LiveAction): LiveState {
  if (a.type === 'connected') return { ...s, connected: a.value }
  const e = a.event
  switch (e.kind) {
    case 'situation':
      return { ...s, situations: [e.data, ...s.situations.filter((x) => x.situation_id !== e.data.situation_id)].slice(0, KEEP_SITUATIONS) }
    case 'routine': {
      const sid = e.data.situation_id
      if (!sid) return s
      return { ...s, routines: { ...s.routines, [sid]: [...(s.routines[sid] ?? []), e.data] } }
    }
    case 'run.progress': {
      const p = e.data
      const prev = s.runs[p.run_id] ?? { run_id: p.run_id, device_id: p.device_id, situation_id: p.situation_id, steps: [] }
      return { ...s, runs: { ...s.runs, [p.run_id]: { ...prev, steps: [...prev.steps, p], wireless: p.wireless ?? prev.wireless } } }
    }
    case 'run.result': {
      const r = e.data
      const prev = s.runs[r.run_id] ?? { run_id: r.run_id, device_id: r.device_id ?? '', situation_id: r.situation_id ?? '', steps: [] }
      return { ...s, runs: { ...s.runs, [r.run_id]: { ...prev, result: r } } }
    }
    case 'robot.plan':
      return { ...s, plans: { ...s.plans, [e.data.situation_id]: e.data.visits } }
    case 'robot.status':
      // A stop does not move the robot: it stays where it was.
      if (e.data.state === 'stopped' && !e.data.device_id) return { ...s, robot: { ...e.data, device_id: s.robot.device_id, room: s.robot.room } }
      return { ...s, robot: e.data }
    case 'robot.route':
      return { ...s, route: e.data }
    case 'notification':
      return { ...s, notifications: [e.data.text, ...s.notifications].slice(0, KEEP_SITUATIONS) }
    default:
      return s // control, mapping, scan: the lists are read again over HTTP
  }
}

/** Runs of one situation, in the order the routine named them. */
export function runsOf(s: LiveState, situationId: string): DeviceRun[] {
  return Object.values(s.runs).filter((r) => r.situation_id === situationId)
}

/** The step a run is on now: the last progress, or `done` once it has a result. */
export function currentStep(r: DeviceRun) {
  return r.result ? 'done' : r.steps.at(-1)?.step ?? 'decide'
}
