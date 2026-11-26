import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { useDevices } from '../api/hooks'
import { Icon } from '../components/Icon'
import { useOpenFailures, useRuns } from '../live/runs'
import { useLive } from '../live/LiveProvider'
import { acted, visitsOf } from '../live/live'
import { CONTROL_KIND_LABEL, CONTROL_KINDS, ROBOT_STATE, SITUATION_STATUS, STEP_LABEL, sentence } from '../live/labels'
import { LiveBar } from './LiveBar'
import { Notifications } from './Notifications'
import { MapView } from '../map/MapView'
import { robotPoint, spotStops, visitStops } from '../map/model'
import { useScene } from '../map/useScene'

// Home: what is happening right now, as square tiles two per row (situation, robot, what waits
// for the resident, and the three control kinds NOVA maps). Each tile leads to the page that tells more.

export function NowPage() {
  const live = useLive()
  const devices = useDevices()
  const map = useScene()
  const controls = useQuery({ queryKey: ['controls'], queryFn: () => unwrap(api.GET('/controls')) }).data ?? []
  const verified = new Set(map.mappings.filter((m) => m.status === 'Verified').map((m) => m.control_id))
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

      <div className="home-top">
        {/* Square tiles, two per row, as in a home app's control list: icon and state on top, name below */}
        <div className="home-tiles">
          <Link to="/flow" className="hub-tile ink" aria-label="Situation">
            <span className="tile-top">
              <span className="bubble"><Icon name="flow" size={24} /></span>
              {situation && <span className="tile-state">{situation.status === 'waiting_for_answer' ? 'Answer' : SITUATION_STATUS[situation.status]}</span>}
            </span>
            <span className="tile-body">
              <span className="eyebrow">Situation</span>
              <strong className="tile-title">{situation ? situation.summary : 'Waiting for a situation.'}</strong>
              {situation && <span className="muted small">{new Date(situation.received_at).toLocaleTimeString()}</span>}
            </span>
          </Link>

          <Link to="/robot" className="hub-tile" aria-label="Robot">
            <span className="tile-top">
              <span className={`bubble ${tone}`}><Icon name="robot" size={24} /></span>
              {task?.step && robot.ral.state !== 'error' && <span className="tile-state">{ROBOT_STATE[robot.state]}</span>}
            </span>
            <span className="tile-body">
              <span className="eyebrow">Robot</span>
              <strong className="tile-title">{robot.ral.state === 'error' ? 'Error: check the robot' : task?.step ? STEP_LABEL[task.step] : ROBOT_STATE[robot.state]}</strong>
              {task?.text && (
                <span className="muted small clamp">
                  {sentence(task.text)}
                  {task.device_id && ` · ${devices.name(task.device_id)}`}
                </span>
              )}
            </span>
          </Link>

          <Link to="/failures" className={`hub-tile ${waiting ? 'attention' : ''}`} aria-label="Needs you">
            <span className="tile-top">
              <span className={`bubble ${waiting ? 'tone-amber' : 'tone-green'}`}><Icon name="alert" size={24} /></span>
              <span className="tile-count"><b>{waiting}</b></span>
            </span>
            <span className="tile-body">
              <span className="eyebrow">Needs you</span>
              <strong className="tile-title">{waiting ? `${waiting === 1 ? 'run waits' : 'runs wait'} for your choice` : 'Nothing is waiting for you'}</strong>
              <span className="muted small">Nothing is tried again on its own.</span>
            </span>
          </Link>

          {CONTROL_KINDS.map((kind) => {
            const mine = controls.filter((c) => c.kind === kind)
            const ok = mine.filter((c) => verified.has(c.control_id)).length
            return (
              <Link key={kind} to="/mappings" className="hub-tile" aria-label={`${CONTROL_KIND_LABEL[kind]}: ${ok} of ${mine.length} Verified`}>
                <span className="tile-top">
                  <span className="bubble tone-accent"><Icon name={kind} size={24} /></span>
                  <span className="tile-count"><b>{ok}</b>/{mine.length}</span>
                </span>
                <span className="tile-body">
                  <span className="eyebrow">Verified</span>
                  <strong className="tile-title">{CONTROL_KIND_LABEL[kind]}</strong>
                </span>
              </Link>
            )
          })}
        </div>

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
