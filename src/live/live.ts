import type { Run } from '../api/client'
import { DOCK, type LiveEvent, type Notification, type PlanItem, type Robot, type RobotRoute, type RunProgress, type Situation, type Step, type Visit } from '../api/proposed'

// Everything the live screens know: a snapshot read over HTTP when the socket opens
// (GET /situations, /visits, /robot), then the WebSocket events; the server keeps nothing
// itself. The hub sends whole objects (a situation with its plan, the whole visit list, the
// robot, the move order), so each event replaces the old one; only run steps are added up.

export type DeviceRun = {
  run_id: string
  device_id: string
  situation_id: string | null
  steps: RunProgress[]
  result?: Run
}

export type LiveState = {
  connected: boolean
  situations: Situation[] // newest first
  runs: Record<string, DeviceRun> // by run_id, only runs seen live
  visits: Visit[]
  robot: Robot
  route: RobotRoute | null // the newest move order
  notifications: Notification[] // newest first
}

const KEEP = 10 // screen memory only

export const IDLE_ROBOT: Robot = { state: 'idle', spot_id: DOCK, task: null, plan: [], ral: { impl: 'script', state: 'idle' } }

export const initialLive: LiveState = {
  connected: false,
  situations: [],
  runs: {},
  visits: [],
  robot: IDLE_ROBOT,
  route: null,
  notifications: [],
}

export type Snapshot = Partial<Pick<LiveState, 'situations' | 'visits' | 'robot'>>

export type LiveAction =
  | { type: 'event'; event: LiveEvent }
  | { type: 'connected'; value: boolean }
  | { type: 'snapshot'; value: Snapshot }

const newestFirst = (xs: Situation[]) =>
  [...xs].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, KEEP)

export function reduce(s: LiveState, a: LiveAction): LiveState {
  if (a.type === 'connected') return { ...s, connected: a.value }
  if (a.type === 'snapshot') {
    const v = a.value
    return {
      ...s,
      situations: v.situations ? newestFirst(v.situations) : s.situations,
      visits: v.visits ?? s.visits,
      robot: v.robot ?? s.robot,
    }
  }
  const e = a.event
  switch (e.kind) {
    case 'situation':
      return { ...s, situations: newestFirst([e.data, ...s.situations.filter((x) => x.situation_id !== e.data.situation_id)]) }
    case 'run.progress': {
      const p = e.data
      const prev = s.runs[p.run_id] ?? { run_id: p.run_id, device_id: p.device_id, situation_id: p.situation_id, steps: [] }
      return { ...s, runs: { ...s.runs, [p.run_id]: { ...prev, steps: [...prev.steps, p] } } }
    }
    case 'run.result': {
      const r = e.data
      const prev = s.runs[r.run_id] ?? { run_id: r.run_id, device_id: r.device_id ?? '', situation_id: null, steps: [] }
      return { ...s, runs: { ...s.runs, [r.run_id]: { ...prev, result: r } } }
    }
    case 'visits':
      return { ...s, visits: e.data.visits }
    case 'robot':
      return { ...s, robot: e.data }
    case 'robot.route':
      return { ...s, route: e.data }
    case 'notification':
      return { ...s, notifications: [e.data, ...s.notifications].slice(0, KEEP) }
    default:
      return s // control, mapping, routine, scan: the lists are read again over HTTP
  }
}

/** The plan items that became runs: what the hub acts on (not the ones it only suggests). */
export const acted = (sit: Situation) => sit.plan.filter((i): i is PlanItem & { run_id: string } => !!i.run_id)

/** The visits of one situation, in order. */
export const visitsOf = (s: LiveState, situationId: string) =>
  s.visits.filter((v) => v.situation_id === situationId).sort((a, b) => a.order - b.order)

const AT_WORK: Visit['status'][] = ['moving', 'pressing', 'checking']
export const isAtWork = (v: Visit) => AT_WORK.includes(v.status)
export const isOver = (v: Visit) => v.status === 'done' || v.status === 'failed' || v.status === 'cancelled'

/** The newest step of a run, if it was seen live. */
export const lastStep = (s: LiveState, runId: string | null | undefined) => (runId ? s.runs[runId]?.steps.at(-1) : undefined)

/** The step a run is on now: its last progress, or `done` once it has a result. */
export const currentStep = (r: DeviceRun): Step | 'done' => (r.result ? 'done' : r.steps.at(-1)?.step ?? 'decide')

/** Busy: the hub is on a task (also while it only sends over wireless) or the robot moves. */
export const isBusy = (r: Robot) => r.task != null || (r.state !== 'idle' && r.state !== 'stopped')
