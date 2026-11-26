import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { LiveEvent } from '../api/proposed'
import { initialLive, reduce, type LiveState, type Snapshot } from './live'

type Live = LiveState & { replay?: () => void }

const LiveContext = createContext<Live>(initialLive)
export const useLive = () => useContext(LiveContext)
export const LiveStateProvider = LiveContext.Provider // for tests: give a state directly

const RECONNECT_MS = 2000

/**
 * The lists to read again after a live event. A control found by a scan, or a mapping that changed,
 * also changes the map (GET /map draws each control at its spot), which is otherwise read only once:
 * without this, a new switch shows in the table but not on the map until a reload.
 */
export function refetchOn(kind: LiveEvent['kind']): string[][] {
  switch (kind) {
    case 'run.result': return [['runs']]
    case 'situation': return [['situations']]
    case 'routine': return [['routines']]
    case 'mapping': return [['mappings'], ['map']]
    case 'control': return [['controls'], ['map']]
    case 'scan': return [['controls'], ['mappings'], ['map']]
    default: return []
  }
}
const MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK !== 'off'

/** What the hub holds now, so a reload or a reconnect does not start from an empty screen. */
async function snapshot(): Promise<Snapshot> {
  const [situations, visits, robot] = await Promise.all([api.GET('/situations'), api.GET('/visits'), api.GET('/robot')])
  return { situations: situations.data, visits: visits.data, robot: robot.data }
}

// One WebSocket to /api/ws/app for the whole app. The real server and the mock send the same
// `{ kind, data }` frames, so this code does not know which one it talks to.
export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialLive)
  const qc = useQueryClient()
  const sock = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const s = new WebSocket(`${proto}://${location.host}/api/ws/app`)
      sock.current = s
      s.onopen = () => {
        dispatch({ type: 'connected', value: true })
        qc.invalidateQueries() // events missed while away: read the lists again
        snapshot().then(
          (value) => !closed && dispatch({ type: 'snapshot', value }),
          () => {}, // the events still come; the screen fills as they do
        )
      }
      s.onmessage = (m) => {
        let event: LiveEvent
        try {
          event = JSON.parse(String(m.data))
        } catch {
          return
        }
        dispatch({ type: 'event', event })
        for (const queryKey of refetchOn(event.kind)) qc.invalidateQueries({ queryKey })
      }
      s.onclose = () => {
        dispatch({ type: 'connected', value: false })
        if (!closed) retry = setTimeout(connect, RECONNECT_MS)
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      sock.current?.close()
    }
  }, [qc])

  const replay = MOCK ? () => sock.current?.send('replay') : undefined
  return <LiveContext.Provider value={{ ...state, replay }}>{children}</LiveContext.Provider>
}
