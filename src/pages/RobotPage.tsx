import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import { useDevices } from '../api/hooks'
import { useLive } from '../live/LiveProvider'
import { isBusy } from '../live/live'
import { ROBOT_STATE, sentence } from '../live/labels'
import { MapView } from '../map/MapView'
import { deviceStops, robotPoint, spotStops, type Selection } from '../map/model'
import { useScene } from '../map/useScene'

// Send the robot: pick places in order. One place is "go here"; more are "stop here, then go
// there". Only devices with a Verified switch have a spot to go to (C-08). The robot checks the
// way before every leg (C-04). Nothing is pressed.
//
// Places are picked on the map, or from a list while the server has no map yet (GET /map is
// still proposed): the order is the same POST /robot/route either way.

const MAX_STOPS = 4 // keeps an order short enough to follow on screen; the spec allows 10

export function RobotPage() {
  const map = useScene()
  const devices = useDevices()
  const live = useLive()
  const [stops, setStops] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/robot/route', { body: { stops } })),
    onSuccess: () => setStops([]),
  })

  const verified = new Set(map.mappings.filter((m) => m.status === 'Verified' && m.device_id).map((m) => m.device_id!))
  const toggle = (id: string) => {
    if (!verified.has(id)) {
      setNote(`${devices.name(id)} has no Verified switch yet, so there is no spot to go to.`)
      return
    }
    setNote(null)
    setStops((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length < MAX_STOPS ? [...xs, id] : xs))
  }
  const pick = (s: Selection) => s?.kind === 'device' && toggle(s.id)

  const robot = live.robot
  const order = <Order stops={stops} name={devices.name} send={send} onClear={() => setStops([])} />

  if (!map.scene) {
    if (!map.error) return <p>Loading…</p>
    // No map from the server yet: the same order, picked from a list.
    return (
      <section>
        <p className="muted">The home map is not set up yet, so pick places from the list, in the order to visit. Select again to remove.</p>
        <ul className="card place-list" aria-label="Places">
          {(devices.data ?? []).map((d) => {
            const n = stops.indexOf(d.device_id)
            return (
              <li key={d.device_id}>
                <button type="button" aria-pressed={n >= 0} disabled={!verified.has(d.device_id)} onClick={() => toggle(d.device_id)}>
                  {n >= 0 && <span className="chip">{n + 1}</span>} {d.name} <span className="muted">· {d.room}</span>
                  {!verified.has(d.device_id) && <span className="muted"> · no Verified switch</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {note && <p className="warn">{note}</p>}
        {order}
      </section>
    )
  }

  const scene = map.scene
  const shown = stops.length ? deviceStops(scene, map.mappings, stops) : spotStops(scene, robot.plan)
  return (
    <section>
      <p className="muted">Select places on the map in the order to visit. Select again to remove.</p>
      <div className="card map-card">
        <MapView
          scene={scene}
          selection={stops.length ? { kind: 'device', id: stops.at(-1)! } : null}
          onSelect={pick}
          robot={robotPoint(scene, robot)}
          route={shown}
          label="Pick places for the robot"
        />
        {note && <p className="warn">{note}</p>}
      </div>
      {order}
    </section>
  )
}

/** The picked stops, the buttons and what the robot does now: the same for the map and the list. */
function Order(props: {
  stops: string[]
  name: (id?: string) => string
  send: { mutate: () => void; isPending: boolean; isError: boolean; error: unknown }
  onClear: () => void
}) {
  const { stops, name, send, onClear } = props
  const live = useLive()
  const robot = live.robot
  const route = live.route
  const busy = isBusy(robot)
  return (
    <>
      <div className="order">
        <ol aria-label="Stops">
          {stops.map((id) => <li key={id}>{name(id)}</li>)}
        </ol>
        {stops.length === 0 && <p className="muted">No place picked.</p>}
        <div className="actions">
          <button type="button" className="primary" disabled={!stops.length || busy || send.isPending} onClick={() => send.mutate()}>
            {stops.length > 1 ? `Go: ${stops.length} stops` : 'Go here'}
          </button>
          <button type="button" disabled={!stops.length} onClick={onClear}>Clear</button>
        </div>
        {busy && (
          <p className="muted">
            The robot is busy: {robot.task?.text ? sentence(robot.task.text) : ROBOT_STATE[robot.state]}. Wait until it is idle.
          </p>
        )}
        {send.isError && <p role="alert" className="error">{send.error instanceof ApiError ? send.error.message : 'The order could not be sent.'}</p>}
      </div>

      {route && (
        <p role="status" className={route.state === 'cancelled' ? 'warn' : 'muted'}>
          {route.state === 'moving' && `On the way: ${route.reached} of ${route.stops.length} reached. The robot checks the way before every leg.`}
          {route.state === 'done' && `Arrived: ${route.stops.length} of ${route.stops.length} reached.`}
          {route.state === 'cancelled' && `Stopped on the way (${route.reason ?? 'cancelled'}). ${route.reached} of ${route.stops.length} reached.`}
        </p>
      )}
    </>
  )
}
