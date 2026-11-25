import { Link } from 'react-router-dom'
import { useDevices } from '../api/hooks'
import { Icon } from '../components/Icon'
import { useOpenFailures, useRuns } from '../live/runs'
import { useLive } from '../live/LiveProvider'
import { acted, visitsOf } from '../live/live'
import { ROBOT_STATE, SITUATION_STATUS, STEP_LABEL, sentence } from '../live/labels'
import { LiveBar } from './LiveBar'
import { Notifications } from './Notifications'
import { MapView } from '../map/MapView'
import { robotPoint, spotStops, visitStops } from '../map/model'
import { useScene } from '../map/useScene'

// Home: what is happening right now, as cards. Each card leads to the page that tells more.

export function NowPage() {
  const live = useLive()
  const devices = useDevices()
  const map = useScene()
  const runs = useRuns()
  const waiting = useOpenFailures()
  const situation = live.situations[0]
  const items = situation ? acted(situation) : []
  const active = items.filter((i) => !i.result)
  const finished = items.filter((i) => i.result)
  const robot = live.robot
  const task = robot.task
  const visits = situation ? visitsOf(live, situation.situation_id) : []
  const tone = robot.state === 'stopped' || robot.ral.state === 'error' ? 'tone-red' : robot.state === 'idle' && !task ? 'tone-gray' : 'tone-green'

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
                <p className="muted small">
                  {new Date(situation.received_at).toLocaleTimeString()} · {SITUATION_STATUS[situation.status]}
                </p>
              </>
            ) : (
              <p className="lead muted">Waiting for a situation.</p>
            )}
            <Link className="pill" to="/flow">{situation?.status === 'waiting_for_answer' ? 'Answer' : 'See the flow'}</Link>
          </div>
        </article>

        <article className="card feature" aria-label="Robot">
          <span className={`bubble ${tone}`}>
            <Icon name="robot" size={26} />
          </span>
          <div>
            <h2 className="eyebrow">Robot</h2>
            <p className="lead">{robot.ral.state === 'error' ? 'Error: check the robot' : task?.step ? STEP_LABEL[task.step] : ROBOT_STATE[robot.state]}</p>
            {task?.text && (
              <p className="muted small">
                {sentence(task.text)}
                {task.device_id && ` · ${devices.name(task.device_id)}`}
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
            <MapView
              scene={map.scene}
              robot={robotPoint(map.scene, robot)}
              route={visits.some((v) => !['done', 'failed', 'cancelled'].includes(v.status)) ? visitStops(map.scene, visits) : spotStops(map.scene, robot.plan)}
              label="The robot and its route on the home map"
            />
          ) : (
            <p className="muted">{map.noMap ? 'The home map is not set up yet.' : map.error ? `Could not load the map: ${map.error.message}` : 'Loading the map…'}</p>
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
          {active.map((i) => {
            const last = live.runs[i.run_id]?.steps.at(-1)
            return (
              <li key={i.run_id} className="tile">
                <span className="chip">{last?.stage ?? 'S4'}</span>
                <strong>{i.name ?? devices.name(i.device_id)}</strong>
                <span>{last ? STEP_LABEL[last.step] : 'Waiting'}</span>
                {(last?.channel ?? i.wireless.channel) && <span className="muted small">{last?.channel ?? i.wireless.channel}</span>}
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
          {finished.map((i) => {
            const run = live.runs[i.run_id]?.result ?? runs.byId.get(i.run_id)
            return (
              <li key={i.run_id} className={`result ${i.result}`}>
                <span className={`status-dot ${i.result}`} aria-hidden="true" />
                <div>
                  <strong>{i.name ?? devices.name(i.device_id)}</strong> <span className="badge">{i.result}</span>
                  <p>{run?.explanation ?? i.reason}</p>
                </div>
                <span className="muted small">{run?.channel}</span>
              </li>
            )
          })}
        </ul>
      )}

      <Notifications />
    </section>
  )
}
