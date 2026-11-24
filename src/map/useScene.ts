import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { proposed } from '../api/extra'
import { buildScene } from './model'

export function useScene() {
  const layout = useQuery({ queryKey: ['map'], queryFn: proposed.map, staleTime: Infinity })
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
