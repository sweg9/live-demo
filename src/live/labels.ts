import type { PlanItem, Robot, Situation, Step, Visit } from '../api/proposed'

// Plain words for the screens (C-07). Codes stay as in the spec and data-model.md; only the
// labels change. Run steps also come with the hub's own plain text (RunProgress.text).

export const STEP_LABEL: Record<Step | 'done', string> = {
  decide: 'Deciding',
  wireless: 'Trying wireless',
  queued: 'Waiting for the robot',
  move: 'Robot moving',
  gate: 'Safety check',
  press: 'Pressing',
  check: 'Checking the result',
  done: 'Done',
}

export const ROBOT_STATE: Record<Robot['state'], string> = {
  idle: 'Idle',
  moving: 'Moving',
  scanning: 'Scanning',
  watching: 'Watching',
  pressing: 'Pressing',
  checking: 'Checking the result',
  stopped: 'Stopped',
}

export const SITUATION_STATUS: Record<Situation['status'], string> = {
  received: 'Received',
  planning: 'Building the plan',
  waiting_for_answer: 'Waiting for your answer',
  running: 'Running',
  done: 'Done',
  needs_attention: 'Needs your choice',
  suggested: 'Only suggested',
  dismissed: 'You said no',
  cancelled: 'Cancelled',
}

export const DECISION_LABEL: Record<PlanItem['decision'], string> = {
  act: 'Do it',
  ask: 'Ask you first',
  suggest: 'Only suggest',
}

export const WIRELESS_LABEL: Record<PlanItem['wireless']['result'], string> = {
  pending: 'Sending…',
  success: 'Success',
  failure: 'Failed',
  no_channel: 'No wireless',
}

export const VISIT_REASON: Record<Visit['reason'], string> = {
  no_channel: 'No wireless channel',
  wireless_failed: 'Wireless failed',
  requested: 'You asked',
}

export const VISIT_STATUS: Record<Visit['status'], string> = {
  waiting: 'Waiting',
  moving: 'Robot moving',
  pressing: 'Safety check and press',
  checking: 'Checking the result',
  done: 'Done',
  failed: 'Did not work',
  cancelled: 'Cancelled',
}

/** The press steps in order, for the progress track (S6). */
export const PRESS_TRACK = ['move', 'gate', 'press', 'check', 'done'] as const

/** "send over IR" → "Send over IR". */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
