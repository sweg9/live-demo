#!/usr/bin/env node
// Turns the map team's LiDAR scan (OBJ + MTL + JPG) into the GLB files the 3D view loads.
//
//   node tools/scan-to-glb.mjs <scan.obj> [--ratio 0.25] [--texture-size 2048]
//
// Writes
//   public/scan/home-shape.glb          shape only: no texture, no photo. Safe for this public repo.
//   local/scan/home-textured.glb with the photo texture. Git-ignored and never built into dist/: it shows personal
//                                       belongings, so it stays on this computer (C-05).
//
// Both are baked into the dashboard frame (src/mocks/layout.ts): metres, x to the right,
// y up from the floor, z = the 2D map's y. Constants come from aligning the 2026-11-24 scan.

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import obj2gltf from 'obj2gltf'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const A = (34.25 * Math.PI) / 180 // turn that makes the walls axis-aligned
const SHIFT_X = 2.5139 // m
const FLIP_Y = 7.6875 // m: Y = FLIP_Y − (x·sin a + y·cos a)
const FLOOR_Z = -1.2989 // m: 1st percentile of the scan's heights

const args = process.argv.slice(2)
const objPath = args.find((a) => !a.startsWith('--'))
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : dflt
}
if (!objPath) {
  console.error('usage: node tools/scan-to-glb.mjs <scan.obj> [--ratio 0.25] [--texture-size 2048]')
  process.exit(1)
}
const RATIO = opt('ratio', 0.25) // share of triangles to keep
const TEX = opt('texture-size', 2048)

// A copy of the scan with a smaller texture (macOS `sips`; without it, the texture keeps its size)
const work = mkdtempSync(join(tmpdir(), 'scan-'))
for (const f of readdirSync(dirname(objPath))) copyFileSync(join(dirname(objPath), f), join(work, f))
for (const f of readdirSync(work).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
  try {
    execFileSync('sips', ['-Z', String(TEX), join(work, f)], { stdio: 'ignore' })
  } catch {
    console.warn(`could not resize ${f}; keeping its size`)
  }
}

const c = Math.cos(A)
const s = Math.sin(A)
function bake(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      const nor = prim.getAttribute('NORMAL')
      const p = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p)
        const [x, y, z] = p
        pos.setElement(i, [x * c - y * s + SHIFT_X, z - FLOOR_Z, FLIP_Y - (x * s + y * c)])
      }
      if (nor) {
        for (let i = 0; i < nor.getCount(); i++) {
          nor.getElement(i, p)
          const [x, y, z] = p
          nor.setElement(i, [x * c - y * s, z, -(x * s + y * c)])
        }
      }
    }
  }
}

async function build(textured) {
  const glb = await obj2gltf(join(work, basename(objPath)), { binary: true })
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })
  const doc = await io.readBinary(new Uint8Array(glb))
  bake(doc)
  if (!textured) {
    for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) prim.setAttribute('TEXCOORD_0', null)
    for (const m of doc.getRoot().listMaterials()) {
      m.setBaseColorTexture(null).setBaseColorFactor([0.86, 0.87, 0.9, 1]).setRoughnessFactor(1).setMetallicFactor(0)
    }
    for (const t of doc.getRoot().listTextures()) t.dispose()
  }
  await MeshoptSimplifier.ready
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  const out = textured ? 'local/scan/home-textured.glb' : 'public/scan/home-shape.glb'
  mkdirSync(dirname(out), { recursive: true })
  const bytes = await io.writeBinary(doc)
  writeFileSync(out, bytes)
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0)
  console.log(`${out}: ${(bytes.length / 1e6).toFixed(2)} MB, ${Math.round(tris)} triangles`)
}

try {
  await build(false)
  await build(true)
} finally {
  rmSync(work, { recursive: true, force: true }) // the working copy of the scan, outside the repo
}
