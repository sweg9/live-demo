import { useQuery } from '@tanstack/react-query'
import { api, unwrap, type Device } from './client'

export function useDevices() {
  const q = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const byId = new Map((q.data ?? []).map((d: Device) => [d.device_id, d]))
  return { ...q, byId, name: (id?: string) => (id ? byId.get(id)?.name ?? id : '') }
}
