import type { PlanItem } from '../api/proposed'
import type { LiveState } from './live'
import { STEP_LABEL, WIRELESS_LABEL } from './labels'

// The live demo in one flow (backend scenario `full_demo`, on the demo/full-flow branch of
// backend-server): map a new switch, then turn its lamp off and on, each time wireless first and
// a press after it fails. The steps are read from the live events only, like every other screen.

export const DEMO_SCENARIO = 'full_demo'

export type DemoStepState = 'todo' | 'now' | 'done' | 'failed'
export type DemoStep = { key: string; title: string; detail: string; state: DemoStepState }

/** The steps of the demo started at `since` (ISO time), as the live events tell them. */
export function demoSteps(live: LiveState, since: string | null): DemoStep[] {
  const after = (at: string) => since !== null && at >= since
  const notes = live.notifications.filter((n) => after(n.at))
  const has = (topic: string) => notes.some((n) => n.topic === topic)
  const situation = (kind: string) => live.situations.find((s) => s.kind === kind && after(s.received_at))

  const scanned = has('flip_request')
  const mapped = has('mapping_fixed')
  const steps: DemoStep[] = [
    {
      key: 'scan',
      title: 'The camera finds a new switch',
      detail: scanned ? 'Found: a new switch, guessed as the ceiling light.' : 'The robot looks along the wall.',
      state: since === null ? 'todo' : scanned ? 'done' : 'now',
    },
    {
      key: 'map',
      title: 'Flip it once: the camera sees what it runs',
      detail: mapped ? 'It runs the stand lamp: the mapping is Verified.' : 'Flip the new switch off and on.',
      state: mapped ? 'done' : scanned ? 'now' : 'todo',
    },
  ]
  for (const [kind, title] of [
    ['leave_home', 'You left home: the lamp goes off'],
    ['come_home', 'You came home: the lamp goes on'],
  ] as const) {
    const sit = situation(kind)
    const item = sit?.plan[0]
    const prev = steps[steps.length - 1]
    steps.push({ key: kind, title, detail: item ? itemDetail(live, item) : prev.state === 'done' ? 'Starts in a moment.' : 'Waits for the step before.', state: itemState(item, prev.state === 'done') })
  }
  return steps
}

function itemState(item: PlanItem | undefined, ready: boolean): DemoStepState {
  if (!item) return ready ? 'now' : 'todo'
  if (item.result === 'success') return 'done'
  if (item.result) return 'failed'
  return 'now'
}

function itemDetail(live: LiveState, item: PlanItem): string {
  const wireless = item.wireless.channel ? `${item.wireless.channel}: ${WIRELESS_LABEL[item.wireless.result].toLowerCase()}` : 'No wireless channel'
  const last = item.run_id ? live.runs[item.run_id]?.steps.at(-1) : undefined
  if (item.result === 'success') return `${wireless}, so the robot pressed the switch. The check confirms it.`
  if (item.result) return `${wireless}. ${item.reason ?? 'It did not work.'}`
  return last ? `${wireless}. Now: ${STEP_LABEL[last.step]}.` : wireless
}
