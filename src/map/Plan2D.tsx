import { useId } from 'react'
import type { Scene } from './model'

// The floor plan under the map's marks: floors, walls with door gaps, and furniture, drawn
// like an architect's plan. Colours follow the scan (wood floors in the rooms, grey tiles in the
// hallway) without using any photo. Without walls in the map, it falls back to room outlines.

type Furniture = Scene['furniture'][number]

const isTiled = (room: string) => /hall|lobby/i.test(room)

export function Plan2D({ scene }: { scene: Scene }) {
  const id = useId().replace(/:/g, '')
  const wood = `wood-${id}`
  const tile = `tile-${id}`
  const plan = scene.walls.length > 0
  const centerX = (r: { x: number; w: number }) => r.x + r.w / 2

  return (
    <g className="plan">
      <defs>
        <pattern id={wood} width="120" height="22" patternUnits="userSpaceOnUse">
          <rect width="120" height="22" className="wood-a" />
          <rect y="11" width="120" height="11" className="wood-b" />
          <path d="M0 0.5H120M0 11.5H120M38 0V11M96 11V22" className="seam" />
        </pattern>
        <pattern id={tile} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" className="tile-a" />
          <path d="M0 0.5H40M0.5 0V40" className="seam" />
        </pattern>
      </defs>

      {scene.rooms.map((r, i) => (
        <rect
          key={i}
          className={plan ? 'floor' : 'room'}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={plan ? `url(#${isTiled(r.room) ? tile : wood})` : undefined}
        />
      ))}

      {scene.furniture.map((f, i) => (
        <FurnitureIcon key={i} f={f} aisleRight={centerX(f) < centerX(roomOf(scene, f) ?? f)} />
      ))}

      {scene.walls.map(([x1, y1, x2, y2, t], i) => (
        <line key={i} className="wall" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={t} />
      ))}

      {scene.rooms.map((r, i) =>
        r.label === false ? null : (
          <text key={i} className="room-label" x={r.x + 14} y={r.y + 28}>{r.room}</text>
        ),
      )}
    </g>
  )
}

function roomOf(scene: Scene, f: Furniture) {
  const cx = f.x + f.w / 2
  const cy = f.y + f.d / 2
  return scene.rooms.find((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h)
}

/** One piece of furniture, seen from above. `aisleRight`: the free floor is to its right. */
function FurnitureIcon({ f, aisleRight }: { f: Furniture; aisleRight: boolean }) {
  const { x, y, w, d } = f
  switch (f.kind) {
    case 'bed': {
      const p = 8 // pillows at the window end (larger y), as in the scan
      return (
        <g className="f-bed">
          <rect x={x} y={y} width={w} height={d} rx={8} className="frame" />
          <rect x={x + p} y={y + p} width={w - 2 * p} height={d - 2 * p} rx={6} className="mattress" />
          <rect x={x + p} y={y + p} width={w - 2 * p} height={(d - 2 * p) * 0.62} rx={6} className="blanket" />
          <path d={`M${x + p} ${y + p + (d - 2 * p) * 0.62} h${w - 2 * p}`} className="fold" />
          <rect x={x + w * 0.18} y={y + d - p - 34} width={w * 0.64} height={26} rx={10} className="pillow" />
        </g>
      )
    }
    case 'desk': {
      const cx = aisleRight ? x + w + 16 : x - 16
      return (
        <g className="f-desk">
          <rect x={x} y={y} width={w} height={d} rx={4} className="top" />
          <rect x={x + 6} y={y + 6} width={w - 12} height={d * 0.32} rx={3} className="shelf" />
          <circle cx={cx} cy={y + d / 2} r={16} className="chair" />
        </g>
      )
    }
    case 'wardrobe':
      return (
        <g className="f-wardrobe">
          <rect x={x} y={y} width={w} height={d} rx={3} className="body" />
          <path d={w < d ? `M${x} ${y + d / 2}h${w}` : `M${x + w / 2} ${y}v${d}`} className="split" />
        </g>
      )
    case 'shelf':
      return (
        <g className="f-shelf">
          <rect x={x} y={y} width={w} height={d} rx={3} className="body" />
          {[0.3, 0.55, 0.8].map((k) => (
            <path key={k} d={`M${x + 5} ${y + d * k}h${w - 10}`} className="split" />
          ))}
        </g>
      )
  }
}
