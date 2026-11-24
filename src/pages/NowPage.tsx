import { useDevices } from '../api/hooks'
import { useLive } from '../live/LiveProvider'
import { currentStep, runsOf } from '../live/live'
import { STEP_LABEL } from '../live/labels'
import { LiveBar } from './LiveBar'

// What is happening right now: the situation, the robot, and every run it started.

export function NowPage() {
  const live = useLive()
  const devices = useDevices()
  const situation = live.situations[0]
  const runs = situation ? runsOf(live, situation.situation_id) : []
  const active = runs.filter((r) => !r.result)
  const finished = runs.filter((r) => r.result)
  const robot = live.robot

  return (
    <section>
      <h1>Now</h1>
      <LiveBar />
      <div className="card-grid">
        <div className="card">
          <h2>Situation</h2>
          {situation ? (
            <>
              <p className="lead">{situation.summary}</p>
              <p className="muted">{new Date(situation.at).toLocaleTimeString()} · trigger: {situation.trigger}</p>
            </>
          ) : (
            <p className="muted">Waiting for a situation.</p>
          )}
        </div>
        <div className="card" aria-label="Robot">
          <h2>Robot</h2>
          <p className="lead">
            {robot.state === 'busy' && robot.step ? STEP_LABEL[robot.step] : robot.state === 'idle' ? 'Idle' : robot.state}
          </p>
          {robot.device_id && (
            <p className="muted">
              {devices.name(robot.device_id)} · {robot.room} · physical press (ARM)
            </p>
          )}
        </div>
        <div className="card placeholder-box">
          <h2>Camera</h2>
          <p className="muted">The robot's camera stays at home: no video leaves the home (C-05). The hub's own dashboard shows it.</p>
        </div>
        <div className="card placeholder-box">
          <h2>Map</h2>
          <p className="muted">The robot on the home map comes with the map component.</p>
        </div>
      </div>

      <h2>Running or waiting ({active.length})</h2>
      {active.length === 0 && <p className="muted">Nothing is running.</p>}
      <ul className="runs">
        {active.map((r) => {
          const last = r.steps.at(-1)
          return (
            <li key={r.run_id} className="run live">
              <span className="badge">{last?.stage ?? 'S4'}</span>
              <span className="what">{devices.name(r.device_id)}</span>
              <span>{STEP_LABEL[currentStep(r)]}</span>
              <span className="meta">{last?.channel ?? ''}</span>
            </li>
          )
        })}
      </ul>

      <h2>Finished ({finished.length})</h2>
      <ul className="runs">
        {finished.map((r) => (
          <li key={r.run_id} className={`run ${r.result!.result}`}>
            <span className="badge">{r.result!.result}</span>
            <span className="what">{r.result!.explanation ?? devices.name(r.device_id)}</span>
            <span />
            <span className="meta">{r.result!.channel}</span>
          </li>
        ))}
      </ul>

      {live.notifications.length > 0 && (
        <>
          <h2>Notifications</h2>
          <ul className="notes">{live.notifications.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </section>
  )
}
