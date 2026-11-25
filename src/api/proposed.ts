import type { Routine, Run, Schemas } from './client'

// The live events and the shapes the dashboard uses, with the team's names (C-02).
//
// Since backend-server 0.5.0 every shape the dashboard needs is in the spec, so they come from
// it. Only GET /map is still PROPOSED (docs/proposed-api.md): it must match the map team's and
// the backend's 3D map first.

export type Situation = Schemas['Situation']
export type PlanItem = Schemas['PlanItem']
export type Visit = Schemas['Visit']
export type Robot = Schemas['Robot']
export type Choice = Schemas['Choice']
export type Step = Schemas['Step']
export type RunProgress = Schemas['RunProgress']
export type RouteOrder = Schemas['RouteOrder']
export type RobotRoute = Schemas['RobotRoute']
export type Notification = Schemas['Notification']
export type ProactiveSetting = Schemas['ProactiveSetting']
export type Resolution = NonNullable<Run['resolution']>
export type Channel = NonNullable<Run['channel']>

export const DOCK = 'dock' // the robot's home spot, as the hub names it

/** `{ kind, data }` on /ws/app, as the spec's description lists them. */
export type LiveEvent =
  | { kind: 'situation'; data: Situation }
  | { kind: 'run.progress'; data: RunProgress }
  | { kind: 'run.result'; data: Run }
  | { kind: 'visits'; data: { visits: Visit[] } }
  | { kind: 'robot'; data: Robot }
  | { kind: 'robot.route'; data: RobotRoute }
  | { kind: 'notification'; data: Notification }
  | { kind: 'routine'; data: Routine }
  | { kind: 'control' | 'mapping' | 'scan'; data: unknown }

/**
 * PROPOSED `GET /map`: the home as the dashboard draws it. Centimetres on the floor, x to the
 * right, y down. `spot_id` names the press spot as the robot reports it (Robot.spot_id,
 * Visit.spot_id). Names, kinds, statuses and risk still come from the lists.
 */
export type Point = { x: number; y: number }
export type HomeLayout = {
  rooms: Array<{ room: string; x: number; y: number; w: number; h: number; label?: boolean }>
  controls: Array<{ control_id: string; at: Point; press_spot: Point; spot_id: string }>
  devices: Array<{ device_id: string; at: Point }>
  dock: Point // where the robot waits; its spot is "dock"
  /** Optional, for drawing: straight walls [x1, y1, x2, y2, thickness]; gaps are doors. */
  walls?: Array<[number, number, number, number, number]>
  /** Optional, for drawing: furniture as boxes; `h` is the height in cm. */
  furniture?: Array<{ kind: 'bed' | 'desk' | 'wardrobe' | 'shelf'; x: number; y: number; w: number; d: number; h: number }>
  /** Optional: ceiling height in cm. */
  ceiling?: number
}
