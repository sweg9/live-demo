import type { Control, Device, Mapping, MappingStatus } from '../api/client'
import { DOCK, type HomeLayout, type Point, type Robot, type Visit } from '../api/proposed'

// What the map draws, worked out from the layout and the API lists. No drawing here, so the
// same model can feed the 2D plan now and the 3D map later.

export type MapControl = { id: string; label: string; kind: Control['kind']; at: Point; pressSpot: Point; room?: string; role: string; caution: boolean }
export type MapDevice = { id: string; name: string; type: string; risk: Device['risk']; room: string; at: Point }
export type MapLink = { id: string; control: string; device: string; from: Point; to: Point; status: MappingStatus; verified: boolean }
export type Selection = { kind: 'control' | 'device'; id: string } | null
export type Stop = { n: number; at: Point; key: string; done: boolean }

export type Scene = {
  rooms: HomeLayout['rooms']
  controls: MapControl[]
  devices: MapDevice[]
  links: MapLink[]
  dock: Point
  /** Press spots and the dock by spot id, where the robot stands. */
  spots: Record<string, Point>
  size: { w: number; h: number }
  /** For drawing only; empty when the map has no plan yet. */
  walls: NonNullable<HomeLayout['walls']>
  furniture: NonNullable<HomeLayout['furniture']>
  ceiling: number
  origin: Point // top-left of everything drawn
}

const KIND_LABEL: Record<Control['kind'], string> = { switch: 'Switch', toggle: 'Toggle', power_strip: 'Power strip' }

/** A name the resident can read for each control, "Switch 2" or "Power strip 1": the API gives
 * controls no name, and the hub's ids are long (ctl_01M8…). Numbered by kind in the order of
 * GET /controls, so a label stays the same while the controls stay the same. */
export function controlLabels(controls: Control[]): Map<string, string> {
  const n: Partial<Record<Control['kind'], number>> = {}
  return new Map(controls.map((c) => [c.control_id, `${KIND_LABEL[c.kind]} ${(n[c.kind] = (n[c.kind] ?? 0) + 1)}`]))
}

const roomAt = (rooms: HomeLayout['rooms'], p: Point) =>
  rooms.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)?.room

export function buildScene(layout: HomeLayout, controls: Control[], devices: Device[], mappings: Mapping[]): Scene {
  const ctl = new Map(controls.map((c) => [c.control_id, c]))
  const labels = controlLabels(controls)
  const dev = new Map(devices.map((d) => [d.device_id, d]))
  const ctlAt = new Map(layout.controls.map((c) => [c.control_id, c]))
  const devAt = new Map(layout.devices.map((d) => [d.device_id, d.at]))

  // Rejected links are not drawn: the resident said no (C-06).
  const links: MapLink[] = mappings.flatMap((m) => {
    const from = ctlAt.get(m.control_id)?.at
    const to = m.device_id ? devAt.get(m.device_id) : undefined
    if (!from || !to || !m.device_id || m.status === 'Rejected') return []
    return [{ id: m.mapping_id, control: m.control_id, device: m.device_id, from, to, status: m.status, verified: m.status === 'Verified' }]
  })

  const mapControls: MapControl[] = layout.controls.flatMap((p) => {
    const c = ctl.get(p.control_id)
    if (!c) return []
    const targets = links.filter((l) => l.control === c.control_id).map((l) => dev.get(l.device)?.name ?? l.device)
    return [{
      id: c.control_id, label: labels.get(c.control_id) ?? c.control_id, kind: c.kind, at: p.at, pressSpot: p.press_spot, room: roomAt(layout.rooms, p.at),
      role: `${KIND_LABEL[c.kind]}${targets.length ? ` → ${targets.join(', ')}` : ' (no device yet)'}`,
      caution: c.kind === 'power_strip', // the robot must not press a socket directly
    }]
  })

  const mapDevices: MapDevice[] = layout.devices.flatMap((p) => {
    const d = dev.get(p.device_id)
    return d ? [{ id: d.device_id, name: d.name, type: d.type, risk: d.risk, room: d.room, at: p.at }] : []
  })

  const walls = layout.walls ?? []
  const xs = [...layout.rooms.flatMap((r) => [r.x, r.x + r.w]), ...walls.flatMap((w) => [w[0], w[2]])]
  const ys = [...layout.rooms.flatMap((r) => [r.y, r.y + r.h]), ...walls.flatMap((w) => [w[1], w[3]])]
  return {
    rooms: layout.rooms, controls: mapControls, devices: mapDevices, links, dock: layout.dock,
    spots: Object.fromEntries([[DOCK, layout.dock], ...layout.controls.map((c) => [c.spot_id, c.press_spot])]),
    size: { w: Math.max(...xs), h: Math.max(...ys) },
    origin: { x: Math.min(...xs), y: Math.min(...ys) },
    walls, furniture: layout.furniture ?? [], ceiling: layout.ceiling ?? 240,
  }
}

/** Ids to highlight for a selection: the item, its links and what they connect to. */
export function highlighted(scene: Scene, sel: Selection): Set<string> {
  if (!sel) return new Set()
  const links = scene.links.filter((l) => (sel.kind === 'control' ? l.control : l.device) === sel.id)
  return new Set([sel.id, ...links.flatMap((l) => [l.id, l.control, l.device])])
}

/** The press spot the robot uses for a device: the control of its Verified mapping (C-08). */
export function pressSpotFor(scene: Scene, mappings: Mapping[], deviceId: string): Point | undefined {
  const m = mappings.find((x) => x.device_id === deviceId && x.status === 'Verified')
  return m ? scene.controls.find((c) => c.id === m.control_id)?.pressSpot : undefined
}

/** The floor point of a spot id as the hub names it (Robot.spot_id, Visit.spot_id). */
export const spotPoint = (scene: Scene, spotId: string): Point | undefined => scene.spots[spotId]

/** Where to draw the robot: at the last spot it reached (the hub reports it), else at the dock. */
export function robotPoint(scene: Scene, robot: Pick<Robot, 'spot_id'>): Point {
  return spotPoint(scene, robot.spot_id) ?? scene.dock
}

/** Devices picked for a move order, as numbered stops at their Verified press spots (C-08). */
export function deviceStops(scene: Scene, mappings: Mapping[], deviceIds: string[]): Stop[] {
  return deviceIds.flatMap((id, i) => {
    const at = pressSpotFor(scene, mappings, id)
    return at ? [{ n: i + 1, at, key: id, done: false }] : []
  })
}

/** Spots still ahead (Robot.plan), as numbered stops. */
export function spotStops(scene: Scene, spotIds: string[]): Stop[] {
  return spotIds.flatMap((id, i) => {
    const at = spotPoint(scene, id)
    return at ? [{ n: i + 1, at, key: `${i}-${id}`, done: false }] : []
  })
}

/** The visit list as numbered stops on the floor; finished visits are marked done. */
export function visitStops(scene: Scene, visits: Visit[]): Stop[] {
  return [...visits]
    .sort((a, b) => a.order - b.order)
    .flatMap((v, i) => {
      const at = spotPoint(scene, v.spot_id)
      return at ? [{ n: i + 1, at, key: v.visit_id, done: v.status === 'done' || v.status === 'failed' || v.status === 'cancelled' }] : []
    })
}
