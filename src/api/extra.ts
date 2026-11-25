import { ApiError, type ApiErrorBody } from './client'
import type { HomeLayout } from './proposed'

// Calls to routes that are still PROPOSED (docs/proposed-api.md). They are not in the spec, so
// the typed client cannot call them. When a route enters backend-server.yaml, move its call to
// `api`.

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
}
