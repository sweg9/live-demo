import type { Mapping, Run } from '../api/client'

// Numbers for History & stats (FR-12), all computed from GET /runs and GET /mappings.

export type Ranked = { key: string; count: number }

const rank = (keys: string[]): Ranked[] =>
  [...keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

// Cancelled runs never tried the channel, so they are left out of the success rates.
export function successRates(runs: Run[]) {
  const rate = (rs: Run[]) => {
    const tried = rs.filter((r) => r.result !== 'cancelled')
    return tried.length ? tried.filter((r) => r.result === 'success').length / tried.length : null
  }
  return {
    wireless: rate(runs.filter((r) => r.channel && r.channel !== 'ARM')),
    arm: rate(runs.filter((r) => r.channel === 'ARM')),
  }
}

// Why runs did not succeed. A cancellation has its own reason; a failure or unsure result has
// none in the spec, so it is grouped by result and channel (for example "failure · WIFI").
export function failureReasons(runs: Run[]): Ranked[] {
  return rank(
    runs
      .filter((r) => r.result !== 'success')
      .map((r) => r.reason ?? [r.result, r.channel].filter(Boolean).join(' · ')),
  )
}

export function frequentDevices(runs: Run[]): Ranked[] {
  return rank(runs.flatMap((r) => (r.device_id ? [r.device_id] : [])))
}

// Share of mappings the system may act on (C-08: only Verified). Rejected ones are left out:
// the resident closed them, so they are not waiting for anything.
export function verifiedShare(mappings: Mapping[]) {
  const open = mappings.filter((m) => m.status !== 'Rejected')
  return open.length ? open.filter((m) => m.status === 'Verified').length / open.length : null
}
