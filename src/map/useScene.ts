import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import { buildScene } from './model'

export function useScene() {
  const layout = useQuery({ queryKey: ['map'], queryFn: () => unwrap(api.GET('/map')), staleTime: Infinity })
  const controls = useQuery({ queryKey: ['controls'], queryFn: () => unwrap(api.GET('/controls')) })
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  // The same Scene object until the data changes: live events re-render the pages several
  // times a second, and the 3D model must not be rebuilt each time.
  const scene = useMemo(
    () => (layout.data && controls.data && devices.data && mappings.data ? buildScene(layout.data, controls.data, devices.data, mappings.data) : undefined),
    [layout.data, controls.data, devices.data, mappings.data],
  )
  const error = layout.error ?? controls.error ?? devices.error ?? mappings.error
  return {
    scene,
    /** True when the server has no map (404): pages show what they can without it. */
    noMap: layout.error instanceof ApiError && layout.error.status === 404,
    mappings: mappings.data ?? [],
    error,
  }
}
