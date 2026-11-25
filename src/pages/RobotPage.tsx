import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import { useDevices } from '../api/hooks'
import { useLive } from '../live/LiveProvider'
import { isBusy } from '../live/live'
import { ROBOT_STATE, sentence } from '../live/labels'
import { MapView } from '../map/MapView'
import { deviceStops, pressSpotFor, robotPoint, spotStops, type Selection } from '../map/model'
import { useScene } from '../map/useScene'

// Send the robot: pick places on the map, in order. One place is "go here"; more are "stop here,
// then go there". Only devices with a Verified switch have a spot to go to (C-08). The robot
// checks the way before every leg (C-04). Nothing is pressed.

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

  if (!map.scene) return <p>{map.error ? `Could not load the map: ${map.error.message}` : 'Loading the map…'}</p>
  const scene = map.scene
  const reachable = (id: string) => !!pressSpotFor(scene, map.mappings, id)

  const pick = (s: Selection) => {
    if (!s || s.kind !== 'device') return
    if (!reachable(s.id)) {
      setNote(`${devices.name(s.id)} has no Verified switch yet, so there is no spot to go to.`)
      return
    }
    setNote(null)
    setStops((xs) => (xs.includes(s.id) ? xs.filter((x) => x !== s.id) : xs.length < MAX_STOPS ? [...xs, s.id] : xs))
  }

  const route = live.route
  const robot = live.robot
  const busy = isBusy(robot)
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

      <div className="order">
        <ol aria-label="Stops">
          {stops.map((id) => <li key={id}>{devices.name(id)}</li>)}
        </ol>
        {stops.length === 0 && <p className="muted">No place picked.</p>}
        <div className="actions">
          <button type="button" className="primary" disabled={!stops.length || busy || send.isPending} onClick={() => send.mutate()}>
            {stops.length > 1 ? `Go: ${stops.length} stops` : 'Go here'}
          </button>
          <button type="button" disabled={!stops.length} onClick={() => setStops([])}>Clear</button>
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
    </section>
  )
}
