import { http, HttpResponse, delay } from 'msw'
import * as fx from './fixtures'

// Browser mock of api/backend-server.yaml. Same paths and shapes as the real server, so turning
// the mock off (VITE_MOCK=off) is the only change needed to use it.
// Kept in memory: a reload starts the demo data again.

const state = {
  mappings: structuredClone(fx.mappings),
  paused: false,
}

const LATENCY_MS = 150 // looks like a network round trip; not a product value

export const handlers = [
  http.get('/api/me', () => HttpResponse.json({ expires_at: new Date(Date.now() + 30 * 864e5).toISOString() })),
  http.get('/api/controls', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.controls))),
  http.get('/api/devices', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.devices))),
  http.get('/api/mappings', async () => (await delay(LATENCY_MS), HttpResponse.json(state.mappings))),
  http.get('/api/routines', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.routines))),
  http.get('/api/runs', async ({ request }) => {
    await delay(LATENCY_MS)
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? fx.runs.length)
    return HttpResponse.json(fx.runs.slice(0, limit))
  }),

  http.post<{ id: string }>('/api/mappings/:id/confirm', ({ params }) => setStatus(params.id, 'Verified')),
  http.post<{ id: string }>('/api/mappings/:id/reject', ({ params }) => setStatus(params.id, 'Rejected')),

  http.post('/api/stop', async () => {
    await delay(LATENCY_MS)
    return HttpResponse.json({ ral: 'stopped' })
  }),
  http.put('/api/proactive', async ({ request }) => {
    const body = (await request.json()) as { paused: boolean }
    state.paused = body.paused
    return HttpResponse.json({ paused: state.paused })
  }),
]

function setStatus(id: string, status: 'Verified' | 'Rejected') {
  const m = state.mappings.find((x) => x.mapping_id === id)
  if (!m) return HttpResponse.json({ code: 'not_found', message: 'No such mapping' }, { status: 404 })
  m.status = status
  return HttpResponse.json(m)
}
