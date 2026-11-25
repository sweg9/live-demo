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

/**
 * NEW kind `situation`: what came in and started routines (S4).
 * `resident` is NEW vocabulary (data-model.md has sensor, time, routine): a run the resident
 * started from the app, such as Try again. Needs a change in harness standards first (C-02).
 */
export type Situation = {
  situation_id: string
  trigger: Run['trigger'] | 'resident'
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

/**
 * NEW route `GET /map`: the home as the map team will provide it (a floor plan now, 3D later).
 * Units are centimetres on the floor, x to the right, y down. Only positions: names, kinds,
 * statuses and risk still come from /controls, /devices and /mappings.
 */
export type Point = { x: number; y: number }
export type HomeLayout = {
  rooms: Array<{ room: string; x: number; y: number; w: number; h: number; label?: boolean }>
  controls: Array<{ control_id: string; at: Point; press_spot: Point }>
  devices: Array<{ device_id: string; at: Point }>
  dock: Point // where the robot waits
  /** Optional, for drawing: straight walls [x1, y1, x2, y2, thickness]; gaps are doors. */
  walls?: Array<[number, number, number, number, number]>
  /** Optional, for drawing: furniture as boxes; `h` is the height in cm. */
  furniture?: Array<{ kind: 'bed' | 'desk' | 'wardrobe' | 'shelf'; x: number; y: number; w: number; d: number; h: number }>
  /** Optional: ceiling height in cm. */
  ceiling?: number
}

/**
 * NEW kind `robot.route`: a move order from the resident ("go here", "stop here, then go
 * there"). Not a run: nothing is pressed. Every leg still passes the safety gate (C-04).
 * `reached` counts the stops the robot has arrived at.
 */
export type RobotRoute = {
  route_id: string
  stops: string[] // device ids, in order
  reached: number
  state: 'moving' | 'done' | 'cancelled'
  reason?: string
}

// ---- NEW HTTP routes (the app calls them; the mock answers) ---------------------------------

/** NEW `POST /runs/{run_id}/retry` → 202. The resident asks again after a failed or unsure run (C-09). */
export type RetryAccepted = { run_id: string; retry_run_id: string }
/** NEW `POST /runs/{run_id}/leave` → 200. The resident leaves it as it is; the run stops asking. */
export type Resolution = 'retried' | 'left'
/** Runs as /runs would list them with the NEW field `resolution`: what the resident chose. */
export type RunWithResolution = Run & { resolution?: Resolution }
/** NEW `POST /robot/route` body → 202 { route_id }. 409 while the robot is busy. */
export type RouteOrder = { stops: string[] }
/** NEW `GET /proactive` → the same ProactiveSetting PUT /proactive saves. */

export type LiveEvent =
  | { kind: 'situation'; data: Situation }
  | { kind: 'robot.route'; data: RobotRoute }
  | { kind: 'routine'; data: Routine & { situation_id?: string } }
  | { kind: 'run.progress'; data: RunProgress }
  | { kind: 'robot.plan'; data: RobotPlan }
  | { kind: 'robot.status'; data: RobotStatus }
  | { kind: 'run.result'; data: Run & { situation_id?: string } }
  | { kind: 'notification'; data: { text: string } }
  | { kind: 'control' | 'mapping' | 'scan'; data: unknown }
