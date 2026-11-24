import type { Routine, Run } from './client'

// PROPOSED, not in api/backend-server.yaml yet.
//
// The app's WebSocket (/api/ws/app) receives `{ kind, data }` (backend-server live.py). The spec
// fixes `kind` but leaves `data` untyped. These are the shapes the dashboard needs. The mock sends
// them; the backend team can adopt, change or reject them. Kinds marked NEW are not in
// AppEvent.kind at all yet.
//
// Names follow skills/standards/data-model.md (C-02).

export type Stage = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7'
export type Channel = 'IR' | 'WIFI' | 'BT' | 'ARM'
export type CheckAnswer = 'yes' | 'no' | 'unsure'

/** NEW kind `situation`: what came in and started routines (S4). */
export type Situation = {
  situation_id: string
  trigger: Run['trigger']
  summary: string // plain language, from a fixed template (C-07)
  at: string // UTC ISO 8601
}

/** Steps inside a run. S4: decide. S5: wireless. S6: queued, move, gate, press, check. */
export type Step = 'decide' | 'wireless' | 'queued' | 'move' | 'gate' | 'press' | 'check'

/** `run.progress`: one step of one run. */
export type RunProgress = {
  run_id: string
  situation_id: string
  device_id: string
  stage: Stage
  step: Step
  channel?: Channel
  /** S5: the outcome for this device. `no_wireless` when the device has no wireless channel. */
  wireless?: 'success' | 'failure' | 'no_wireless'
  /** `check`: the camera or platform answer. `gate`: whether the safety gate passed (C-04). */
  answer?: CheckAnswer
  gate?: 'pass' | 'fail'
  reason?: string
}

/** NEW kind `robot.plan`: the devices the robot will visit, in order (S6). */
export type Visit = {
  device_id: string
  run_id: string
  why: 'wireless_failed' | 'no_wireless' | 'resident_asked'
}
export type RobotPlan = { situation_id: string; visits: Visit[] }

/** NEW kind `robot.status`: what the robot is doing now. `state` matches RalStatus.state. */
export type RobotStatus = {
  state: 'idle' | 'busy' | 'stopped' | 'error'
  device_id?: string
  step?: Step
  room?: string
}

export type LiveEvent =
  | { kind: 'situation'; data: Situation }
  | { kind: 'routine'; data: Routine & { situation_id?: string } }
  | { kind: 'run.progress'; data: RunProgress }
  | { kind: 'robot.plan'; data: RobotPlan }
  | { kind: 'robot.status'; data: RobotStatus }
  | { kind: 'run.result'; data: Run & { situation_id?: string } }
  | { kind: 'notification'; data: { text: string } }
  | { kind: 'control' | 'mapping' | 'scan'; data: unknown }
