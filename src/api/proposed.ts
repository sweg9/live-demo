import type { Routine, Run, Schemas } from './client'

// The live events and the shapes the dashboard uses, with the team's names (C-02).
//
// Since backend-server 0.6.0 every shape the dashboard needs is in the spec, including the home
// map (HomeLayout), so they all come from it.

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

/** `GET /map` (since 0.6.0): the home as the dashboard draws it. Centimetres on the floor, x to the
 * right, y down. `spot_id` names the press spot as the robot reports it (Robot.spot_id, Visit.spot_id). */
export type HomeLayout = Schemas['HomeLayout']
export type Point = Schemas['Point']
