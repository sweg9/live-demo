import type { Step, Visit } from '../api/proposed'

// Plain words for the screens (C-07). Codes stay as in data-model.md; only the labels change.

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

export const WHY_LABEL: Record<Visit['why'], string> = {
  wireless_failed: 'Wireless failed',
  no_wireless: 'No wireless channel',
  resident_asked: 'You asked',
}

export const WIRELESS_LABEL = { success: 'Success', failure: 'Failed', no_wireless: 'No wireless' } as const

/** The press steps in order, for the progress track (S6). */
export const PRESS_TRACK = ['move', 'gate', 'press', 'check', 'done'] as const
