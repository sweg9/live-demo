import { ApiError, type ApiErrorBody } from './client'
import type { HomeLayout, RetryAccepted, RouteOrder, RunWithResolution } from './proposed'

// Calls to the PROPOSED routes (api/proposed.ts). They are not in the spec, so the typed client
// cannot call them yet. When a route enters backend-server.yaml, move its call to `api`.

const base = () => `${globalThis.location?.origin ?? ''}/api`

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await globalThis.fetch(`${base()}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  const data = text ? JSON.parse(text) : undefined
  if (!r.ok) throw new ApiError(r.status, data as ApiErrorBody | undefined)
  return data as T
}

export const proposed = {
  map: () => call<HomeLayout>('GET', '/map'),
  retry: (runId: string) => call<RetryAccepted>('POST', `/runs/${encodeURIComponent(runId)}/retry`),
  leave: (runId: string) => call<RunWithResolution>('POST', `/runs/${encodeURIComponent(runId)}/leave`),
  route: (order: RouteOrder) => call<{ route_id: string }>('POST', '/robot/route', order),
  proactive: () => call<{ paused: boolean }>('GET', '/proactive'),
}
