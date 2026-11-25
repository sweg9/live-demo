import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { proposed } from '../api/extra'
import { buildScene } from './model'

export function useScene() {
  const layout = useQuery({ queryKey: ['map'], queryFn: proposed.map, staleTime: Infinity })
  const controls = useQuery({ queryKey: ['controls'], queryFn: () => unwrap(api.GET('/controls')) })
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  // The same Scene object until the data changes: live events re-render the pages several
  // times a second, and the 3D model must not be rebuilt each time.
  const scene = useMemo(
    () => (layout.data && controls.data && devices.data && mappings.data ? buildScene(layout.data, controls.data, devices.data, mappings.data) : undefined),
    [layout.data, controls.data, devices.data, mappings.data],
  )
  return {
    scene,
    mappings: mappings.data ?? [],
    error: layout.error ?? controls.error ?? devices.error ?? mappings.error,
  }
}
