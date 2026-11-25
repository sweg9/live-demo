import type { Control, Device, Mapping, Routine, Run } from '../api/client'

// Demo data for the browser mock. Names follow skills/standards/data-model.md exactly (C-02).
// No faces, photos or personal data (C-05).

export const controls: Control[] = [
  { control_id: 'ctl-living-1', kind: 'switch', state: 'on', actions: ['flip'], position: [0.32, 0.41] },
  { control_id: 'ctl-living-2', kind: 'switch', state: 'off', actions: ['flip'], position: [0.58, 0.41] },
  { control_id: 'ctl-bed-1', kind: 'toggle', state: 'off', actions: ['flip'], position: [0.5, 0.5] },
  { control_id: 'ctl-bed-strip', kind: 'power_strip', state: 'on', actions: ['press'], position: [0.2, 0.85] },
  { control_id: 'ctl-living-3', kind: 'switch', state: 'on', actions: ['flip'], position: [0.74, 0.41] },
  { control_id: 'ctl-bed-2', kind: 'switch', state: 'on', actions: ['flip'], position: [0.66, 0.5] },
]

export const devices: Device[] = [
  { device_id: 'dev-ceiling', name: 'Ceiling light', type: 'light', room: 'Room A', risk: 'low', channels: ['WIFI', 'ARM'] },
  { device_id: 'dev-fan', name: 'Fan', type: 'fan', room: 'Room A', risk: 'low', channels: ['IR', 'ARM'] },
  { device_id: 'dev-desk', name: 'Desk lamp', type: 'light', room: 'Room B', risk: 'low', channels: ['ARM'] },
  { device_id: 'dev-heater', name: 'Heater', type: 'heater', room: 'Room B', risk: 'high', channels: ['ARM'] },
  { device_id: 'dev-floor', name: 'Floor lamp', type: 'light', room: 'Room A', risk: 'low', channels: ['ARM'] },
  { device_id: 'dev-purifier', name: 'Air purifier', type: 'air_purifier', room: 'Room B', risk: 'low', channels: ['IR', 'ARM'] },
]

export const mappings: Mapping[] = [
  { mapping_id: 'map-1', control_id: 'ctl-living-1', device_id: 'dev-ceiling', status: 'Verified', confidence: 0.93 },
  { mapping_id: 'map-2', control_id: 'ctl-living-2', device_id: 'dev-fan', status: 'Pending', confidence: 0.83 },
  { mapping_id: 'map-3', control_id: 'ctl-bed-1', device_id: 'dev-desk', status: 'Stale', confidence: 0.18 },
  { mapping_id: 'map-4', control_id: 'ctl-bed-strip', device_id: 'dev-heater', status: 'Verified', confidence: 0.88 },
  { mapping_id: 'map-5', control_id: 'ctl-living-3', device_id: 'dev-floor', status: 'Verified', confidence: 0.9 },
  { mapping_id: 'map-6', control_id: 'ctl-bed-2', device_id: 'dev-purifier', status: 'Verified', confidence: 0.86 },
]

export const routines: Routine[] = [
  { routine_id: 'rt-1', mapping_id: 'map-1', action: 'off', time: '23:30', source: 'habit', independence: 'act_and_tell', priority: 1 },
  { routine_id: 'rt-2', mapping_id: 'map-4', action: 'off', time: '07:00', source: 'manual', independence: 'ask_first', priority: 2 },
]

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

export const runs: Run[] = [
  {
    run_id: 'run-5', trigger: 'time', intent: 'Turn off the ceiling light', device_id: 'dev-ceiling',
    confidence: 0.93, channel: 'WIFI', result: 'success', started_at: ago(12),
    explanation: 'At 23:30 the ceiling light was turned off over Wi-Fi, as it is every night.',
  },
  {
    run_id: 'run-4', trigger: 'sensor', intent: 'Turn off the fan', device_id: 'dev-fan',
    confidence: 0.83, channel: 'ARM', result: 'success', started_at: ago(55),
    explanation: 'The room got cold, IR did not reach the fan, so the robot pressed its switch.',
  },
  {
    run_id: 'run-3', trigger: 'routine', intent: 'Turn off the heater', device_id: 'dev-heater',
    confidence: 0.88, channel: 'ARM', result: 'cancelled', reason: 'person_in_work_area', started_at: ago(130),
    explanation: 'The press was cancelled because someone was near the power strip.',
  },
  {
    run_id: 'run-2', trigger: 'time', intent: 'Turn on the desk lamp', device_id: 'dev-desk',
    confidence: 0.18, channel: 'ARM', result: 'unsure', started_at: ago(300),
    explanation: 'The camera could not tell whether the desk lamp turned on. Nothing was pressed again.',
  },
  {
    run_id: 'run-1', trigger: 'sensor', intent: 'Turn on the ceiling light', device_id: 'dev-ceiling',
    confidence: 0.91, channel: 'WIFI', result: 'failure', started_at: ago(600),
    explanation: 'Wi-Fi did not answer within 5 s and the light stayed off.',
  },
]
