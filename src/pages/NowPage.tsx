import { Link } from 'react-router-dom'
import { useDevices } from '../api/hooks'
import { Icon } from '../components/Icon'
import { useOpenFailures } from '../components/Layout'
import { useLive } from '../live/LiveProvider'
import { currentStep, runsOf } from '../live/live'
import { STEP_LABEL } from '../live/labels'
import { LiveBar } from './LiveBar'
import { HomeMap } from '../map/HomeMap'
import { robotPoint, routeOf, routeStops } from '../map/model'
import { useScene } from '../map/useScene'

// Home: what is happening right now, as cards. Each card leads to the page that tells more.

const ROBOT_STATE = { idle: 'Idle', busy: 'Working', stopped: 'Stopped', error: 'Error: check the robot' } as const

export function NowPage() {
  const live = useLive()
  const devices = useDevices()
  const map = useScene()
  const waiting = useOpenFailures()
  const situation = live.situations[0]
  const runs = situation ? runsOf(live, situation.situation_id) : []
  const active = runs.filter((r) => !r.result)
  const finished = runs.filter((r) => r.result)
  const robot = live.robot
  // robot.status arrives only when the robot starts a visit or a press; the run's own steps are
  // finer (gate, check), so the robot card follows the run it is working on.
  const robotRun = robot.state === 'busy' ? active.find((r) => r.device_id === robot.device_id) : undefined
  const robotStep = robotRun ? currentStep(robotRun) : robot.step

  return (
    <section className="home">
      <LiveBar />

      <div className="cards">
        <article className="card feature">
          <span className="bubble tone-indigo"><Icon name="flow" size={26} /></span>
          <div>
            <h2 className="eyebrow">Situation</h2>
            {situation ? (
              <>
                <p className="lead">{situation.summary}</p>
                <p className="muted small">{new Date(situation.at).toLocaleTimeString()} · trigger: {situation.trigger}</p>
              </>
            ) : (
              <p className="lead muted">Waiting for a situation.</p>
            )}
            <Link className="pill" to="/flow">See the flow</Link>
          </div>
        </article>

        <article className="card feature" aria-label="Robot">
          <span className={`bubble ${robot.state === 'stopped' || robot.state === 'error' ? 'tone-red' : robot.state === 'busy' ? 'tone-green' : 'tone-gray'}`}>
            <Icon name="robot" size={26} />
          </span>
          <div>
            <h2 className="eyebrow">Robot</h2>
            <p className="lead">{robot.state === 'busy' && robotStep ? STEP_LABEL[robotStep] : ROBOT_STATE[robot.state]}</p>
            {robot.device_id && (
              <p className="muted small">
                {devices.name(robot.device_id)} · {robot.room} · physical press (ARM)
              </p>
            )}
            <Link className="pill" to="/robot">Send the robot</Link>
          </div>
        </article>

        <article className={`card feature ${waiting ? 'attention' : ''}`}>
          <span className={`bubble ${waiting ? 'tone-amber' : 'tone-green'}`}><Icon name="alert" size={26} /></span>
          <div>
            <h2 className="eyebrow">Needs you</h2>
            <p className="lead">{waiting ? `${waiting} ${waiting === 1 ? 'run waits' : 'runs wait'} for your choice` : 'Nothing is waiting for you'}</p>
            <p className="muted small">Nothing is tried again on its own.</p>
            {waiting > 0 && <Link className="pill" to="/failures">Review</Link>}
          </div>
        </article>

        <article className="card map-tile">
          <div className="card-head">
            <h2 className="eyebrow">Home map</h2>
            <Link className="pill" to="/mappings">Devices</Link>
          </div>
          {map.scene ? (
            <HomeMap
              scene={map.scene}
              robot={robotPoint(map.scene, map.mappings, robot)}
              route={
                live.route?.state === 'moving'
                  ? routeStops(map.scene, map.mappings, live.route)
                  : situation
                    ? routeOf(map.scene, map.mappings, live.plans[situation.situation_id] ?? [], (id) => !!live.runs[id]?.result)
                    : []
              }
              label="The robot and its route on the home map"
            />
          ) : (
            <p className="muted">{map.error ? `Could not load the map: ${map.error.message}` : 'Loading the map…'}</p>
          )}
          <p className="muted small">The robot's camera stays at home: no video leaves the home (C-05).</p>
        </article>
      </div>

      <div className="section-head">
        <h2>Running or waiting ({active.length})</h2>
      </div>
      {active.length === 0 ? (
        <p className="empty">Nothing is running.</p>
      ) : (
        <ul className="tiles">
          {active.map((r) => {
            const last = r.steps.at(-1)
            return (
              <li key={r.run_id} className="tile">
                <span className="chip">{last?.stage ?? 'S4'}</span>
                <strong>{devices.name(r.device_id)}</strong>
                <span>{STEP_LABEL[currentStep(r)]}</span>
                {last?.channel && <span className="muted small">{last.channel}</span>}
              </li>
            )
          })}
        </ul>
      )}

      <div className="section-head">
        <h2>Finished ({finished.length})</h2>
      </div>
      {finished.length > 0 && (
        <ul className="list-card results">
          {finished.map((r) => (
            <li key={r.run_id} className={`result ${r.result!.result}`}>
              <span className={`status-dot ${r.result!.result}`} aria-hidden="true" />
              <div>
                <strong>{devices.name(r.device_id)}</strong> <span className="badge">{r.result!.result}</span>
                <p>{r.result!.explanation}</p>
              </div>
              <span className="muted small">{r.result!.channel}</span>
            </li>
          ))}
        </ul>
      )}

      {live.notifications.length > 0 && (
        <>
          <div className="section-head">
            <h2>Notifications</h2>
          </div>
          <ul className="list-card notes">{live.notifications.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </section>
  )
}
