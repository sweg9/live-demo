import { useMutation } from '@tanstack/react-query'
import { api, ApiError, unwrap } from '../api/client'
import type { PlanItem, Situation } from '../api/proposed'
import { useDevices } from '../api/hooks'
import { useLive } from '../live/LiveProvider'
import { acted, currentStep, isAtWork, visitsOf, type DeviceRun } from '../live/live'
import { DECISION_LABEL, PRESS_TRACK, SITUATION_STATUS, STEP_LABEL, VISIT_REASON, VISIT_STATUS, WIRELESS_LABEL, sentence } from '../live/labels'
import { LiveBar } from './LiveBar'

// Situation → plan → wireless (S5) → visit list → press (S6), for the newest situation.
// The robot is sent by the system, not by hand: this page only shows it, and asks the resident
// when the hub waits for an answer (FR-06).

export function FlowPage() {
  const live = useLive()
  const devices = useDevices()
  const situation = live.situations[0]

  if (!situation) {
    return (
      <section>
        <LiveBar />
        <p className="muted">Waiting for a situation.</p>
      </section>
    )
  }

  const sid = situation.situation_id
  const visits = visitsOf(live, sid)
  const atWork = visits.find(isAtWork)
  const current = atWork?.run_id ? live.runs[atWork.run_id] : undefined
  const name = (i: { device_id: string; name?: string }) => i.name ?? devices.name(i.device_id)

  return (
    <section>
      <LiveBar />
      <ol className="flow">
        <li className="flow-step">
          <h2>1. Situation</h2>
          <p className="lead">{situation.summary}</p>
          <p className="muted small">
            {new Date(situation.received_at).toLocaleTimeString()} · trigger: {situation.trigger} · {SITUATION_STATUS[situation.status]}
          </p>
          {situation.status === 'waiting_for_answer' && <Answer situation={situation} />}
        </li>

        <li className="flow-step" aria-label="Plan">
          <h2>2. Plan</h2>
          {situation.plan.length === 0 ? (
            <p className="muted">{situation.status === 'received' || situation.status === 'planning' ? 'Building the plan…' : 'Nothing to do.'}</p>
          ) : (
            <ul className="chips">
              {situation.plan.map((i) => (
                <li key={i.device_id} className="chip">
                  {name(i)}: turn {i.action} · {DECISION_LABEL[i.decision]}
                  {i.routine_id ? ' · your routine' : ''}
                </li>
              ))}
            </ul>
          )}
        </li>

        <li className="flow-step" aria-label="Wireless results">
          <h2>3. Wireless (S5)</h2>
          <table className="table">
            <thead><tr><th>Device</th><th>Channel</th><th>Result</th></tr></thead>
            <tbody>
              {acted(situation).map((i) => (
                <tr key={i.device_id}>
                  <td>{name(i)}</td>
                  <td>{i.wireless.channel ?? '—'}</td>
                  <td>
                    <span className={`badge w-${i.wireless.result}`}>{WIRELESS_LABEL[i.wireless.result]}</span>
                    {i.wireless.reason && <span className="muted small"> {i.wireless.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>

        <li className="flow-step" aria-label="Visit order">
          <h2>4. Robot visits (S6)</h2>
          {visits.length === 0 && <p className="muted">{visitsNote(acted(situation))}</p>}
          <ol className="visits">
            {visits.map((v) => {
              const r = v.run_id ? live.runs[v.run_id] : undefined
              return (
                <li key={v.visit_id} className={v === atWork ? 'now' : ''}>
                  <span className="what">{devices.name(v.device_id)}</span>
                  <span className="muted">{VISIT_REASON[v.reason]}</span>
                  <span>
                    {r?.result ? <span className={`badge run-${r.result.result}`}>{r.result.result}</span> : VISIT_STATUS[v.status]}
                  </span>
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

/** Before the visit list: still trying wireless, planning the visits, or nothing to visit. */
export function visitsNote(items: PlanItem[]) {
  if (items.some((i) => i.wireless.result === 'pending')) return 'Waiting for the wireless results.'
  if (items.every((i) => i.result === 'success')) return 'Nothing left for the robot.'
  return 'Planning the visits…'
}

/** FR-06: the hub asks before it acts. Yes starts the plan; no does nothing (C-06). */
function Answer({ situation }: { situation: Situation }) {
  const id = situation.situation_id
  const send = useMutation({
    mutationFn: (yes: boolean) =>
      unwrap(yes ? api.POST('/situations/{situation_id}/approve', { params: { path: { situation_id: id } } }) : api.POST('/situations/{situation_id}/dismiss', { params: { path: { situation_id: id } } })),
  })
  return (
    <div className="actions">
      <button type="button" className="primary" disabled={send.isPending} onClick={() => send.mutate(true)}>Yes, go ahead</button>
      <button type="button" disabled={send.isPending} onClick={() => send.mutate(false)}>No, do nothing</button>
      {send.isError && <p role="alert" className="error">{send.error instanceof ApiError ? send.error.message : 'The answer could not be sent.'}</p>}
    </div>
  )
}

function Track({ run, name }: { run: DeviceRun; name: string }) {
  const now = currentStep(run)
  const at = PRESS_TRACK.indexOf(now as (typeof PRESS_TRACK)[number])
  const text = run.steps.at(-1)?.text
  return (
    <div>
      <p>{name}{text && <span className="muted small"> · {sentence(text)}</span>}</p>
      <ol className="track" aria-label="Press progress">
        {PRESS_TRACK.map((step, i) => (
          <li key={step} className={i < at ? 'past' : i === at ? 'now' : ''}>{STEP_LABEL[step]}</li>
        ))}
      </ol>
    </div>
  )
}
