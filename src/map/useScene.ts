import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import type { HomeLayout } from '../api/proposed'
import { buildScene } from './model'

// GET /map is a PROPOSED route (api/proposed.ts), so it is not in the typed client yet.
async function getLayout(): Promise<HomeLayout> {
  const r = await globalThis.fetch(`${globalThis.location?.origin ?? ''}/api/map`, { credentials: 'include' })
  if (!r.ok) throw new Error(`GET /map: HTTP ${r.status}`)
  return r.json()
}

export function useScene() {
  const layout = useQuery({ queryKey: ['map'], queryFn: getLayout, staleTime: Infinity })
  const controls = useQuery({ queryKey: ['controls'], queryFn: () => unwrap(api.GET('/controls')) })
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  const ready = layout.data && controls.data && devices.data && mappings.data
  return {
    scene: ready ? buildScene(layout.data!, controls.data!, devices.data!, mappings.data!) : undefined,
    mappings: mappings.data ?? [],
    error: layout.error ?? controls.error ?? devices.error ?? mappings.error,
  }
}
