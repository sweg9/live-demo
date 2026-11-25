import type { KeyboardEvent } from 'react'
import type { Point } from '../api/proposed'
import { highlighted, type Scene, type Selection, type Stop } from './model'
import { Plan2D } from './Plan2D'

// The home as a 2D floor plan. It takes a Scene (map/model.ts), so a 3D map can replace the
// drawing later without changing the pages that use it.
//
// Links: solid = Verified, dashed = a guess (Pending or Stale); Rejected links are not drawn.
// Route: calm arrows on the floor with the visit order.

type Props = {
  scene: Scene
  selection?: Selection
  onSelect?: (s: Selection) => void
  robot?: Point
  route?: Stop[]
  label?: string
}

const PAD = 50

export function HomeMap({ scene, selection = null, onSelect, robot, route = [], label = 'Home map' }: Props) {
  const hl = highlighted(scene, selection)
  const dim = (id: string) => (selection && !hl.has(id) ? ' dim' : '')
  const on = (id: string) => (hl.has(id) ? ' hl' : '')
  const pick = (s: Selection) => () => onSelect?.(selection && s && selection.id === s.id ? null : s)
  const keys = (s: Selection) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(s)()
    }
  }
  const remaining = route.filter((s) => !s.done)
  const path = robot && remaining.length ? [robot, ...remaining.map((s) => s.at)] : []

  return (
    <svg
      className="home-map"
      viewBox={`${scene.origin.x - PAD} ${scene.origin.y - PAD} ${scene.size.w - scene.origin.x + PAD * 2} ${scene.size.h - scene.origin.y + PAD * 2}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="route-head" />
        </marker>
      </defs>

      <Plan2D scene={scene} />

      {path.length > 1 &&
        path.slice(1).map((p, i) => (
          <line key={i} className="route" x1={path[i].x} y1={path[i].y} x2={p.x} y2={p.y} markerEnd="url(#arrow)" />
        ))}

      {scene.links.map((l) => (
        <line
          key={l.id}
          data-testid={`link-${l.id}`}
          className={`link ${l.confirmed ? 'confirmed' : 'guess'}${on(l.id)}${dim(l.id)}`}
          x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
          strokeDasharray={l.confirmed ? undefined : '10 8'}
        />
      ))}

      {route.map((s) => (
        <g key={s.n} className={`stop${s.done ? ' done' : ''}`} aria-label={`Visit ${s.n}`}>
          <circle cx={s.at.x} cy={s.at.y} r={15} />
          <text x={s.at.x} y={s.at.y + 5} textAnchor="middle">{s.n}</text>
        </g>
      ))}

      {scene.devices.map((d) => {
        const s: Selection = { kind: 'device', id: d.id }
        return (
          <g
            key={d.id}
            className={`device risk-${d.risk}${on(d.id)}${dim(d.id)}`}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${d.name}, ${d.room}`}
            aria-pressed={onSelect ? selection?.id === d.id : undefined}
            onClick={onSelect && pick(s)}
            onKeyDown={onSelect && keys(s)}
          >
            <circle cx={d.at.x} cy={d.at.y} r={18} />
            <text className="item-label" x={d.at.x} y={d.at.y + 40} textAnchor="middle">{d.name}</text>
          </g>
        )
      })}

      {scene.controls.map((c) => {
        const s: Selection = { kind: 'control', id: c.id }
        return (
          <g
            key={c.id}
            className={`control kind-${c.kind}${c.caution ? ' caution' : ''}${on(c.id)}${dim(c.id)}`}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${c.role}${c.caution ? ', caution' : ''}`}
            aria-pressed={onSelect ? selection?.id === c.id : undefined}
            onClick={onSelect && pick(s)}
            onKeyDown={onSelect && keys(s)}
          >
            <rect x={c.at.x - 12} y={c.at.y - 12} width={24} height={24} rx={5} />
            {c.caution && <text className="caution-mark" x={c.at.x} y={c.at.y + 6} textAnchor="middle">!</text>}
          </g>
        )
      })}

      {robot && (
        <g className="robot" aria-label="Robot position">
          <rect x={robot.x - 20} y={robot.y - 20} width={40} height={40} rx={10} />
          <text x={robot.x} y={robot.y + 6} textAnchor="middle">R</text>
        </g>
      )}
    </svg>
  )
}

/** The tag of the selected item: name, place, role. Shown next to the map. */
export function MapTag({ scene, selection }: { scene: Scene; selection: Selection }) {
  if (!selection) return <p className="muted map-tag">Select a switch or a device on the map.</p>
  if (selection.kind === 'device') {
    const d = scene.devices.find((x) => x.id === selection.id)
    if (!d) return null
    const by = scene.links.filter((l) => l.device === d.id)
    return (
      <div className="map-tag" aria-label="Selected item">
        <strong>{d.name}</strong> · {d.room} · {d.type}
        {d.risk === 'high' && <span className="badge high">high risk</span>}
        <div className="muted">
          {by.length ? by.map((l) => `${l.control} (${l.confirmed ? 'confirmed' : 'guess'})`).join(', ') : 'No switch linked yet'}
        </div>
      </div>
    )
  }
  const c = scene.controls.find((x) => x.id === selection.id)
  if (!c) return null
  return (
    <div className="map-tag" aria-label="Selected item">
      <strong>{c.id}</strong> · {c.room ?? '—'} · {c.role}
      {c.caution && <span className="badge high">caution: do not press directly</span>}
    </div>
  )
}
