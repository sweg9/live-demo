import { http, HttpResponse, delay, ws } from 'msw'
import type { Run } from '../api/client'
import * as fx from './fixtures'
import { bedtimeScenario } from './scenario'

// Browser mock of api/backend-server.yaml. Same paths and shapes as the real server, so turning
// the mock off (VITE_MOCK=off) is the only change needed to use it.
// Kept in memory: a reload starts the demo data again.

const state = {
  mappings: structuredClone(fx.mappings),
  runs: structuredClone(fx.runs) as Run[],
  paused: false,
}

// The app's live WebSocket. Each connection plays the bedtime scenario; the message "replay"
// plays it again. The real server ignores what the app sends, so the app may send it anyway.
export const REPLAY = 'replay'
const live = ws.link('*/api/ws/app')

const liveHandler = live.addEventListener('connection', ({ client }) => {
  let timers: ReturnType<typeof setTimeout>[] = []
  const play = () => {
    timers.forEach(clearTimeout)
    timers = []
    let at = 0
    for (const { delayMs, event } of bedtimeScenario()) {
      at += delayMs
      timers.push(
        setTimeout(() => {
          if (event.kind === 'run.result') state.runs.unshift(event.data)
          client.send(JSON.stringify(event))
        }, at),
      )
    }
  }
  client.addEventListener('message', (e) => e.data === REPLAY && play())
  client.addEventListener('close', () => timers.forEach(clearTimeout))
  play()
})

const LATENCY_MS = 150 // looks like a network round trip; not a product value

export const handlers = [
  liveHandler,
  http.get('/api/me', () => HttpResponse.json({ expires_at: new Date(Date.now() + 30 * 864e5).toISOString() })),
  http.get('/api/controls', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.controls))),
  http.get('/api/devices', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.devices))),
  http.get('/api/mappings', async () => (await delay(LATENCY_MS), HttpResponse.json(state.mappings))),
  http.get('/api/routines', async () => (await delay(LATENCY_MS), HttpResponse.json(fx.routines))),
  http.get('/api/runs', async ({ request }) => {
    await delay(LATENCY_MS)
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? state.runs.length)
    return HttpResponse.json(state.runs.slice(0, limit))
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
