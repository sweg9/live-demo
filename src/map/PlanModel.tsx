import { memo, useMemo } from 'react'
import * as THREE from 'three'
import type { Scene } from './model'

// A clean 3D model built from the map's plan (walls, floors, furniture): straight walls and flat
// floors instead of the raw scan. Walls stop at WALL_H, a cut-away, so the rooms can be seen from
// above. Materials are plain colours and textures drawn in code: no photo (C-05).

export const WALL_H = 1.3 // m
const m = (cm: number) => cm / 100
const isTiled = (room: string) => /hall|lobby/i.test(room)

const C = {
  wall: '#f3f1ec', wallTop: '#5b5e66', wood: '#c9a272', linen: '#fbfaf7', blanket: '#c9d3e6', pillow: '#ffffff',
  desk: '#d0ad7c', wardrobe: '#d8c19a', shelf: '#cdb48b', chair: '#8f96a3',
}

// Memoised: pages re-render on every live event; the model only changes with the plan.
export const PlanModel = memo(function PlanModel({ scene }: { scene: Scene }) {
  const wood = useFloorTexture('wood')
  const tile = useFloorTexture('tile')
  const wallMats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.95 })
    const top = new THREE.MeshStandardMaterial({ color: C.wallTop, roughness: 0.8 })
    return [side, side, top, side, side, side] // +x −x +y −y +z −z
  }, [])
  const floorTex = useMemo(
    () =>
      scene.rooms.map((r) => {
        const tiled = isTiled(r.room)
        const tex = (tiled ? tile : wood).clone()
        tex.repeat.set(tiled ? m(r.w) / 0.4 : m(r.w) / 1.2, tiled ? m(r.h) / 0.4 : m(r.h) / 0.44)
        tex.needsUpdate = true
        return tex
      }),
    [scene.rooms, wood, tile],
  )

  return (
    <group>
      {scene.rooms.map((r, i) => (
        <mesh key={i} position={[m(r.x + r.w / 2), 0.002 * (i + 1), m(r.y + r.h / 2)]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[m(r.w), m(r.h)]} />
          <meshStandardMaterial map={floorTex[i]} roughness={0.85} />
        </mesh>
      ))}

      {scene.walls.map(([x1, y1, x2, y2, t], i) => {
        const horizontal = y1 === y2
        const len = m(Math.abs(x2 - x1) + Math.abs(y2 - y1) + t) // + t closes the corners
        const size: [number, number, number] = horizontal ? [len, WALL_H, m(t)] : [m(t), WALL_H, len]
        return (
          <mesh key={i} position={[m((x1 + x2) / 2), WALL_H / 2, m((y1 + y2) / 2)]} material={wallMats} castShadow receiveShadow>
            <boxGeometry args={size} />
          </mesh>
        )
      })}

      {scene.furniture.map((f, i) => (
        <Furniture key={i} f={f} aisleRight={aisleRight(scene, f)} />
      ))}
    </group>
  )
})

function aisleRight(scene: Scene, f: Scene['furniture'][number]) {
  const cx = f.x + f.w / 2
  const room = scene.rooms.find((r) => cx >= r.x && cx <= r.x + r.w && f.y + f.d / 2 >= r.y && f.y + f.d / 2 <= r.y + r.h)
  return room ? cx < room.x + room.w / 2 : true
}

function Box({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

function Furniture({ f, aisleRight }: { f: Scene['furniture'][number]; aisleRight: boolean }) {
  const x = m(f.x), z = m(f.y), w = m(f.w), d = m(f.d)
  const cx = x + w / 2, cz = z + d / 2
  const h = Math.min(m(f.h), WALL_H - 0.05)
  switch (f.kind) {
    case 'bed':
      return (
        <group>
          <Box at={[cx, 0.16, cz]} size={[w, 0.32, d]} color={C.wood} />
          <Box at={[cx, 0.4, cz]} size={[w - 0.08, 0.16, d - 0.08]} color={C.linen} />
          <Box at={[cx, 0.49, z + 0.04 + (d - 0.08) * 0.31]} size={[w - 0.06, 0.04, (d - 0.08) * 0.62]} color={C.blanket} />
          <Box at={[cx, 0.51, z + d - 0.22]} size={[w * 0.62, 0.08, 0.26]} color={C.pillow} />
        </group>
      )
    case 'desk': {
      const side = aisleRight ? 1 : -1
      return (
        <group>
          <Box at={[cx, 0.735, cz]} size={[w, 0.04, d]} color={C.desk} />
          <Box at={[x + (aisleRight ? w * 0.2 : w * 0.8), 0.36, cz]} size={[w * 0.36, 0.72, d - 0.06]} color={C.desk} />
          <Box at={[cx, 1.05, z + d - 0.12]} size={[w - 0.04, 0.5, 0.2]} color={C.shelf} />
          <group position={[aisleRight ? x + w + 0.18 : x - 0.18, 0, cz]}>
            <Box at={[0, 0.45, 0]} size={[0.4, 0.06, 0.4]} color={C.chair} />
            <Box at={[side * 0.18, 0.72, 0]} size={[0.05, 0.5, 0.38]} color={C.chair} />
            <Box at={[0, 0.22, 0]} size={[0.06, 0.44, 0.06]} color="#6d7380" />
          </group>
        </group>
      )
    }
    case 'wardrobe':
      return <Box at={[cx, h / 2, cz]} size={[w, h, d]} color={C.wardrobe} />
    case 'shelf':
      return <Box at={[cx, h / 2, cz]} size={[w, h, d]} color={C.shelf} />
  }
}

/** Plank or tile textures drawn on a canvas once: no image files, no photo. */
function useFloorTexture(kind: 'wood' | 'tile') {
  return useMemo(() => {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')!
    if (kind === 'wood') {
      c.width = 512
      c.height = 128
      const tones = ['#e6cda2', '#e0c597', '#e9d2a9', '#dcc092']
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 160
        for (let col = -1; col < 3; col++) {
          ctx.fillStyle = tones[(row + col + 4) % 4]
          ctx.fillRect(off + col * 320, row * 32, 320, 32)
          ctx.strokeStyle = 'rgba(110,80,40,0.18)'
          ctx.strokeRect(off + col * 320 + 0.5, row * 32 + 0.5, 320, 32)
        }
      }
    } else {
      c.width = c.height = 128
      ctx.fillStyle = '#d6d0c5'
      ctx.fillRect(0, 0, 128, 128)
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, 126, 126)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [kind])
}
