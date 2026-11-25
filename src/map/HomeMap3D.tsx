import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bounds, Html, Line, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Point } from '../api/proposed'
import { highlighted, type Scene, type Selection, type Stop } from './model'
import { SHAPE_URL, TEXTURED_URL } from './urls'
import { PlanModel } from './PlanModel'

// The home in 3D with the same marks as the 2D plan. A 2D point (X, Y) in cm sits at
// (X/100, height, Y/100) here.
//
// Sources: `model` (default) is a clean model built from the plan's walls, floors and furniture
// (map/PlanModel.tsx). `scan` is the raw LiDAR shape (public/scan/home-shape.glb, baked into the
// same frame by tools/scan-to-glb.mjs). `photo` is the textured scan, served only by the dev
// server on the owner's computer (C-05).

export type Source = 'model' | 'scan' | 'photo'

const CUT_HEIGHT = 1.8 // m: the raw scan is cut here, like a doll's house
const MARK_HEIGHT = 1.15 // m: devices and switches float here (their real heights are not known)
const ROBOT_SPEED = 0.9 // m/s on screen; display only
const COLORS = { accent: '#4c55e0', guess: '#b8730a', high: '#e5484d', control: '#16181d', caution: '#b8730a', route: '#858a95', robot: '#4c55e0' }

type Props = {
  scene: Scene
  selection?: Selection
  onSelect?: (s: Selection) => void
  robot?: Point
  route?: Stop[]
  label?: string
  source?: Source
}

const at = (p: Point, y = MARK_HEIGHT) => new THREE.Vector3(p.x / 100, y, p.y / 100)

export default function HomeMap3D({ scene, selection = null, onSelect, robot, route = [], label = 'Home map in 3D', source = 'model' }: Props) {
  const hl = highlighted(scene, selection)
  const { x: minX, y: minY } = scene.origin
  const center = useMemo(() => new THREE.Vector3((minX + scene.size.w) / 200, 0, (minY + scene.size.h) / 200), [minX, minY, scene.size.w, scene.size.h])
  const span = Math.max(scene.size.w - minX, scene.size.h - minY) / 100
  const useModel = source === 'model' && scene.walls.length > 0
  const pick = (s: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect?.(selection && s && selection.id === s.id ? null : s)
  }

  return (
    <div className="home-map-3d" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [center.x + span * 0.35, span * 0.95, center.z + span * 0.85], fov: 40, near: 0.1, far: 100 }}
        gl={{ localClippingEnabled: true, antialias: true }}
        shadows
        onPointerMissed={() => onSelect?.(null)}
      >
        <color attach="background" args={['#eef0f4']} />
        <hemisphereLight args={['#ffffff', '#d4d6de', 1.35]} />
        <Sun center={center} span={span} />
        {/* Bounds frames the whole home whatever the screen size, then the resident can orbit */}
        <Bounds fit clip margin={1.05}>
          {useModel ? (
            <PlanModel scene={scene} />
          ) : (
            <Suspense fallback={<Html center><span className="muted">Loading the scan…</span></Html>}>
              <Scan url={source === 'photo' ? TEXTURED_URL : SHAPE_URL} textured={source === 'photo'} />
            </Suspense>
          )}
        </Bounds>

        {scene.links.map((l) => (
          <Line
            key={l.id}
            points={[at(l.from), at(l.to)]}
            color={l.confirmed ? COLORS.accent : COLORS.guess}
            lineWidth={hl.has(l.id) ? 5 : 2.5}
            dashed={!l.confirmed}
            dashSize={0.08}
            gapSize={0.06}
            transparent
            opacity={selection && !hl.has(l.id) ? 0.2 : 0.9}
          />
        ))}

        {scene.devices.map((d) => (
          <group key={d.id} position={at(d.at)} onClick={onSelect && pick({ kind: 'device', id: d.id })}>
            <mesh>
              <sphereGeometry args={[hl.has(d.id) ? 0.13 : 0.1, 24, 16]} />
              <meshStandardMaterial color={d.risk === 'high' ? COLORS.high : COLORS.accent} transparent opacity={selection && !hl.has(d.id) ? 0.3 : 1} />
            </mesh>
            <Html position={[0, 0.22, 0]} center distanceFactor={6} zIndexRange={[10, 0]}>
              <span className={`tag3d${hl.has(d.id) ? ' on' : ''}`}>{d.name}</span>
            </Html>
          </group>
        ))}

        {scene.controls.map((c) => (
          <mesh key={c.id} position={at(c.at)} onClick={onSelect && pick({ kind: 'control', id: c.id })}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color={c.caution ? COLORS.caution : COLORS.control} transparent opacity={selection && !hl.has(c.id) ? 0.3 : 1} />
          </mesh>
        ))}

        {robot && <Robot to={at(robot, 0)} />}
        {robot && route.filter((s) => !s.done).length > 0 && (
          <Line points={[at(robot, 0.03), ...route.filter((s) => !s.done).map((s) => at(s.at, 0.03))]} color={COLORS.route} lineWidth={3} dashed dashSize={0.05} gapSize={0.12} />
        )}
        {route.map((s) => (
          <Html key={s.n} position={at(s.at, 0.05)} center distanceFactor={6} zIndexRange={[10, 0]}>
            <span className={`stop3d${s.done ? ' done' : ''}`} aria-label={`Visit ${s.n}`}>{s.n}</span>
          </Html>
        ))}

        <OrbitControls target={center} enablePan={false} minDistance={3} maxDistance={span * 2} maxPolarAngle={Math.PI * 0.45} makeDefault />
      </Canvas>
    </div>
  )
}

/** Soft daylight from the south-east, aimed at the middle of the home, with shadows. */
function Sun({ center, span }: { center: THREE.Vector3; span: number }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.copy(center)
    scene.add(light.target)
    return () => {
      scene.remove(light.target)
    }
  }, [center, scene])
  return (
    <directionalLight
      ref={ref}
      position={[center.x + 3, 9, center.z + 5]}
      intensity={1.6}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-span}
      shadow-camera-right={span}
      shadow-camera-top={span}
      shadow-camera-bottom={-span}
      shadow-bias={-0.0005}
    />
  )
}

/** The scan, with everything above CUT_HEIGHT clipped away. */
function Scan({ url, textured }: { url: string; textured: boolean }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const root = scene.clone(true)
    const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_HEIGHT)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const old = mesh.material as THREE.MeshStandardMaterial
      mesh.material = new THREE.MeshStandardMaterial({
        map: textured ? old.map : null,
        color: textured ? '#ffffff' : '#dcdee5',
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide, // the scan is seen from inside the rooms
        clippingPlanes: [cut],
      })
    })
    return root
  }, [scene, textured])
  return <primitive object={model} />
}

/** The robot: a small cart that drives to its spot instead of jumping. */
function Robot({ to }: { to: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (ref.current && !ready) {
      ref.current.position.copy(to)
      setReady(true)
    }
  }, [to, ready])
  useFrame((_s, dt) => {
    const g = ref.current
    if (!g) return
    const d = to.clone().sub(g.position)
    const dist = d.length()
    if (dist < 0.005) return
    const step = Math.min(dist, ROBOT_SPEED * dt)
    g.position.addScaledVector(d.normalize(), step)
    g.rotation.y = Math.atan2(d.x, d.z)
  })
  return (
    <group ref={ref} name="robot">
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.36, 0.2, 0.46]} />
        <meshStandardMaterial color={COLORS.robot} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.32, 0.12]}>
        <boxGeometry args={[0.08, 0.22, 0.08]} />
        <meshStandardMaterial color="#c3c7ff" />
      </mesh>
    </group>
  )
}

useGLTF.preload(SHAPE_URL)
