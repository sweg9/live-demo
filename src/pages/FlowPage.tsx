import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { useDevices } from '../api/hooks'
import { useLive } from '../live/LiveProvider'
import { currentStep, runsOf, type DeviceRun } from '../live/live'
import { PRESS_TRACK, STEP_LABEL, WHY_LABEL, WIRELESS_LABEL } from '../live/labels'
import { LiveBar } from './LiveBar'

// Situation → routine → wireless (S5) → visit list → press (S6), for the newest situation.
// The robot is sent by the system, not by hand: this page only shows it.

export function FlowPage() {
  const live = useLive()
  const devices = useDevices()
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  const deviceOf = new Map((mappings.data ?? []).map((m) => [m.mapping_id, m.device_id ?? undefined]))
  const situation = live.situations[0]

  if (!situation) {
    return (
      <section>
        <h1>Situation → run</h1>
        <LiveBar />
        <p className="muted">Waiting for a situation.</p>
      </section>
    )
  }

  const sid = situation.situation_id
  const runs = runsOf(live, sid)
  const routines = live.routines[sid] ?? []
  const visits = live.plans[sid] ?? []
  const current = visits.map((v) => live.runs[v.run_id]).find((r) => r && !r.result)

  return (
    <section>
      <h1>Situation → run</h1>
      <LiveBar />
      <ol className="flow">
        <li className="flow-step">
          <h2>1. Situation</h2>
          <p className="lead">{situation.summary}</p>
        </li>

        <li className="flow-step">
          <h2>2. Routine</h2>
          <ul className="chips">
            {routines.map((rt) => (
              <li key={rt.routine_id} className="chip">
                {devices.name(deviceOf.get(rt.mapping_id) ?? rt.mapping_id)}: turn {rt.action}
              </li>
            ))}
          </ul>
        </li>

        <li className="flow-step" aria-label="Wireless results">
          <h2>3. Wireless (S5)</h2>
          <table className="table">
            <thead><tr><th>Device</th><th>Channel</th><th>Result</th></tr></thead>
            <tbody>
              {runs.map((r) => {
                const tried = r.steps.find((s) => s.stage === 'S5' && s.channel)
                return (
                  <tr key={r.run_id}>
                    <td>{devices.name(r.device_id)}</td>
                    <td>{tried?.channel ?? '—'}</td>
                    <td>{r.wireless ? <span className={`badge w-${r.wireless}`}>{WIRELESS_LABEL[r.wireless]}</span> : <span className="muted">…</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </li>

        <li className="flow-step" aria-label="Visit order">
          <h2>4. Robot visits (S6)</h2>
          {visits.length === 0 && <p className="muted">{visitsNote(runs)}</p>}
          <ol className="visits">
            {visits.map((v) => {
              const r = live.runs[v.run_id]
              return (
                <li key={v.run_id} className={r === current ? 'now' : ''}>
                  <span className="what">{devices.name(v.device_id)}</span>
                  <span className="muted">{WHY_LABEL[v.why]}</span>
                  <span>{r?.result ? <span className={`badge run-${r.result.result}`}>{r.result.result}</span> : r ? STEP_LABEL[currentStep(r)] : ''}</span>
                </li>
              )
            })}
          </ol>
        </li>

        <li className="flow-step">
          <h2>5. Press progress</h2>
          {current ? <Track run={current} name={devices.name(current.device_id)} /> : <p className="muted">The robot is not pressing anything now.</p>}
        </li>
      </ol>
    </section>
  )
}

// Before robot.plan arrives: still trying wireless, planning the visits, or nothing to visit.
export function visitsNote(runs: DeviceRun[]) {
  if (runs.some((r) => !r.wireless)) return 'Waiting for the wireless results.'
  if (runs.every((r) => r.wireless === 'success')) return 'Nothing left for the robot.'
  return 'Planning the visits…'
}

function Track({ run, name }: { run: DeviceRun; name: string }) {
  const now = currentStep(run)
  const at = PRESS_TRACK.indexOf(now as (typeof PRESS_TRACK)[number])
  return (
    <div>
      <p>{name}</p>
      <ol className="track" aria-label="Press progress">
        {PRESS_TRACK.map((step, i) => (
          <li key={step} className={i < at ? 'past' : i === at ? 'now' : ''}>{STEP_LABEL[step]}</li>
        ))}
      </ol>
    </div>
  )
}
