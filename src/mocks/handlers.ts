import { http, HttpResponse, delay, ws, type HttpResponseResolver, type PathParams } from 'msw'
import * as fx from './fixtures'
import { hub } from './hub'
import { layout } from './layout'

// Browser mock of api/backend-server.yaml (0.6.0). Same paths and shapes as the real server, so turning the mock off (VITE_MOCK=off)
// is the only change needed to use it. The records and the live events live in mocks/hub.ts.

export const REPLAY = 'replay'
const LATENCY_MS = 150 // looks like a network round trip; not a product value

// The app's live WebSocket. Like the real server, it refuses a screen without a session. Each
// connection plays the bedtime scenario; the message "replay" plays it again. The real server
// ignores what the app sends, so the app may send it anyway.
const live = ws.link('*/api/ws/app')
const liveHandler = live.addEventListener('connection', ({ client }) => {
  if (!hub.state.signedIn) {
    client.close(1008, 'signed out')
    return
  }
  hub.send = (event) => client.send(JSON.stringify(event))
  hub.closeLive = () => client.close(1008, 'signed out')
  client.addEventListener('message', (e) => e.data === REPLAY && hub.bedtime())
  hub.bedtime()
})

const SIGNED_OUT = { code: 'signed_out', message: 'Sign in first' }

/** Every route but /login needs the session, as on the real server. */
type Resolver<P extends PathParams> = HttpResponseResolver<P, any, any>
function signedIn<P extends PathParams = PathParams>(resolver: Resolver<P>): Resolver<P> {
  return (info) => (hub.state.signedIn ? resolver(info) : HttpResponse.json(SIGNED_OUT, { status: 401 }))
}

const reply = ({ status, body }: { status: number; body?: unknown }) =>
  body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body as object, { status })

export const handlers = [
  liveHandler,

  // Session
  http.post('/api/login', async ({ request }) => {
    await delay(LATENCY_MS)
    const { password } = (await request.json()) as { password?: string }
    return reply(hub.login(password ?? ''))
  }),
  http.post('/api/logout', () => {
    hub.state.signedIn = false
    hub.cancel()
    hub.closeLive?.()
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/api/me', signedIn(() => HttpResponse.json({ expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }))),

  // Lists
  http.get('/api/controls', signedIn(async () => (await delay(LATENCY_MS), HttpResponse.json(fx.controls)))),
  http.get('/api/devices', signedIn(async () => (await delay(LATENCY_MS), HttpResponse.json(fx.devices)))),
  http.get('/api/mappings', signedIn(async () => (await delay(LATENCY_MS), HttpResponse.json(hub.state.mappings)))),
  http.get('/api/routines', signedIn(async () => (await delay(LATENCY_MS), HttpResponse.json(hub.state.routines)))),
  http.post<{ id: string }>('/api/routines/:id/feedback', signedIn(async ({ params, request }) => reply(hub.feedback(params.id, (await request.json()) as object)))),
  http.get('/api/runs', signedIn(async ({ request }) => {
    await delay(LATENCY_MS)
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? hub.state.runs.length)
    return HttpResponse.json(hub.state.runs.slice(0, limit))
  })),
  http.get('/api/map', signedIn(() => HttpResponse.json(layout))),

  // Situations, visits and the robot (0.4.0)
  http.get('/api/situations', signedIn(() =>
    HttpResponse.json([...hub.state.situations.values()].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, 50)),
  )),
  http.get<{ id: string }>('/api/situations/:id', signedIn(({ params }) => {
    const sit = hub.state.situations.get(params.id)
    return sit ? HttpResponse.json(sit) : HttpResponse.json({ code: 'not_found', message: 'Unknown id' }, { status: 404 })
  })),
  http.post<{ id: string }>('/api/situations/:id/approve', signedIn(({ params }) => reply(hub.answer(params.id, true)))),
  http.post<{ id: string }>('/api/situations/:id/dismiss', signedIn(({ params }) => reply(hub.answer(params.id, false)))),
  http.get('/api/visits', signedIn(() => HttpResponse.json(hub.state.visits))),
  http.get('/api/robot', signedIn(() => HttpResponse.json(hub.state.robot))),

  // Mappings
  http.post<{ id: string }>('/api/mappings/:id/confirm', signedIn(({ params }) => setStatus(params.id, 'Verified'))),
  http.post<{ id: string }>('/api/mappings/:id/reject', signedIn(({ params }) => setStatus(params.id, 'Rejected'))),

  // Runs: what the resident chooses after a failure (C-09)
  http.post<{ id: string }>('/api/runs/:id/retry', signedIn(({ params }) => reply(hub.retry(params.id)))),
  http.post<{ id: string }>('/api/runs/:id/leave', signedIn(({ params }) => reply(hub.leave(params.id)))),

  // Move order
  http.post('/api/robot/route', signedIn(async ({ request }) => {
    const { stops } = (await request.json()) as { stops: unknown }
    return reply(hub.route(stops))
  })),

  // Safety
  http.post('/api/stop', signedIn(async () => {
    await delay(LATENCY_MS)
    hub.stop()
    return HttpResponse.json({ ral: 'stopped' })
  })),
  http.get('/api/proactive', signedIn(() => HttpResponse.json({ paused: hub.state.paused }))),
  http.put('/api/proactive', signedIn(async ({ request }) => {
    const body = (await request.json()) as { paused: boolean }
    hub.state.paused = body.paused
    return HttpResponse.json({ paused: hub.state.paused })
  })),
]

function setStatus(id: string, status: 'Verified' | 'Rejected') {
  const m = hub.state.mappings.find((x) => x.mapping_id === id)
  if (!m) return HttpResponse.json({ code: 'not_found', message: 'No such mapping' }, { status: 404 })
  m.status = status
  return HttpResponse.json(m)
}
