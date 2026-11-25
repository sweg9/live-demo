import { useQuery } from '@tanstack/react-query'
import { api, unwrap, type Run } from '../api/client'

// GET /runs, shared by every screen under one query key. The live socket invalidates it on each
// run.result, so lists and badges follow the hub.

const LIMIT = 100 // the newest runs a screen shows; not a product value
const OPEN: Run['result'][] = ['failure', 'unsure', 'cancelled']

/** C-09: a failed, unsure or cancelled run waits for the resident until `resolution` is set. */
export const isOpenFailure = (r: Run) => OPEN.includes(r.result) && r.resolution == null

export function useRuns() {
  const q = useQuery({ queryKey: ['runs'], queryFn: () => unwrap(api.GET('/runs', { params: { query: { limit: LIMIT } } })) })
  const list = q.data ?? []
  return { ...q, list, byId: new Map(list.map((r) => [r.run_id, r])) }
}

/** Runs waiting for the resident's choice, for the badges. */
export function useOpenFailures() {
  return useRuns().list.filter(isOpenFailure).length
}
