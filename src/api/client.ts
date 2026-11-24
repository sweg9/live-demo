import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

// One client for the whole app, typed from api/backend-server.yaml (the team's contract).
// The session is an HttpOnly cookie, so the browser sends it on its own (same origin).
// Absolute base: openapi-fetch builds a Request before fetching, and outside a browser page
// (tests) a relative URL has nothing to resolve against.
// fetch is looked up on every call, not captured once, so a mock installed later still sees it.
export const api = createClient<paths>({
  baseUrl: `${globalThis.location?.origin ?? ''}/api`,
  credentials: 'include',
  fetch: (req) => globalThis.fetch(req),
})

export type Schemas = components['schemas']
export type Control = Schemas['Control']
export type Device = Schemas['Device']
export type Mapping = Schemas['Mapping']
export type MappingStatus = Schemas['MappingStatus']
export type Routine = Schemas['Routine']
export type Run = Schemas['Run']
export type ApiErrorBody = Schemas['Error']

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | undefined,
  ) {
    super(body?.message ?? `HTTP ${status}`)
  }
}

// openapi-fetch returns { data, error, response }; pages want data or a thrown error.
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined)
  return data as T
}
