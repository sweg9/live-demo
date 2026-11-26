import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import { useLive } from '../live/LiveProvider'
import { isBusy } from '../live/live'
import { DEMO_SCENARIO, demoSteps } from '../live/demo'
import { ROBOT_STATE, sentence } from '../live/labels'
import { MapView } from '../map/MapView'
import { robotPoint, spotStops, visitStops } from '../map/model'
import { useScene } from '../map/useScene'

// The live demo in one flow, for the video: one button plays the hub's `full_demo` scenario
// (needs the hub with --demo-scenarios). The scan, the IR answer and the checks are the
// scenario's fixed answers; the orchestrator, the safety gate and the press are real, and with
// `hand: linear_actuators` the press is the real actuator. The emergency stop stays at the top.
// Always speed 1: the hub divides its waits by the speed, the time on the switch (HOLD_S) too, so
// a faster run would pull the real actuator back before the switch went down.

const SPEED = 1

export function DemoPage() {
  const live = useLive()
  const map = useScene()
  const [since, setSince] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: () => {
      const at = new Date(Date.now() - 1000).toISOString() // a little early: the hub's clock may differ slightly
      return unwrap(api.POST('/scenarios/{name}/start', { params: { path: { name: DEMO_SCENARIO }, query: { speed: SPEED } } })).then(() => at)
    },
    onSuccess: (at) => setSince(at),
  })
  const steps = demoSteps(live, since)
  const busy = isBusy(live.robot)
  const finished = steps.every((s) => s.state === 'done')
  const visits = live.visits.filter((v) => !['done', 'failed', 'cancelled'].includes(v.status))

  return (
    <section className="demo">
      <div className="demo-grid">
        <div className="card demo-panel">
          <h2 className="eyebrow">Live demo</h2>
          <p className="lead">Map a new switch, then turn its lamp off and on. Wireless goes first; when it fails, the robot presses the switch.</p>
          <div className="actions demo-actions">
            <button type="button" className="primary" disabled={start.isPending || (busy && !finished)} onClick={() => start.mutate()}>
              {since ? 'Run the demo again' : 'Run the demo'}
            </button>
            <span className="muted small">Plays in real time: about a minute.</span>
          </div>
          {busy && !since && <p className="muted small">The robot is busy: {live.robot.task?.text ? sentence(live.robot.task.text) : ROBOT_STATE[live.robot.state]}.</p>}
          {start.isError && (
            <p role="alert" className="error">
              {start.error instanceof ApiError && start.error.status === 404
                ? 'The hub plays no demo scenarios: start it with --demo-scenarios, from the demo/full-flow branch of backend-server.'
                : start.error instanceof ApiError ? start.error.message : 'The demo could not start.'}
            </p>
          )}

          <ol className="demo-steps" aria-label="Demo steps">
            {steps.map((s, n) => (
              <li key={s.key} className={s.state} aria-current={s.state === 'now' ? 'step' : undefined}>
                <span className="demo-n" aria-hidden="true">{s.state === 'done' ? '✓' : n + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p className="muted small">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {finished && <p role="status" className="ok">Done: mapped, then off and on by the robot after wireless failed.</p>}
          <p className="muted small">The scan, the IR answer and the camera checks are the scenario's fixed answers. The safety gate and the press are real.</p>
        </div>

        <div className="card map-tile">
          <div className="card-head"><h2 className="eyebrow">Home map</h2></div>
          {map.scene ? (
            <MapView
              scene={map.scene}
              robot={robotPoint(map.scene, live.robot)}
              route={visits.length ? visitStops(map.scene, visits) : spotStops(map.scene, live.robot.plan)}
              label="The robot on the home map during the demo"
            />
          ) : (
            <p className="muted">{map.noMap ? 'The home map is not set up yet.' : 'Loading the map…'}</p>
          )}
        </div>
      </div>
    </section>
  )
}
