import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, unwrap, type Device, type Mapping } from '../api/client'
import { MapTag } from '../map/HomeMap'
import { MapView } from '../map/MapView'
import { highlighted, type Selection } from '../map/model'
import { useScene } from '../map/useScene'

// FR-02, C-06, C-08: the resident confirms or rejects a mapping, or says which device the control
// really runs (PATCH /mappings/{id}). A changed device goes back to Pending, so nothing runs it
// until it is checked or confirmed again. Only Verified mappings are used, so the status is
// always shown next to the link. Selecting a switch on the map (or its row)
// highlights the devices it is linked to.

export function MappingsPage() {
  const qc = useQueryClient()
  const mappings = useQuery({ queryKey: ['mappings'], queryFn: () => unwrap(api.GET('/mappings')) })
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => unwrap(api.GET('/devices')) })
  const map = useScene()
  const [selection, setSelection] = useState<Selection>(null)

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'confirm' | 'reject' }) =>
      verb === 'confirm'
        ? unwrap(api.POST('/mappings/{mapping_id}/confirm', { params: { path: { mapping_id: id } } }))
        : unwrap(api.POST('/mappings/{mapping_id}/reject', { params: { path: { mapping_id: id } } })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['mappings'] }),
  })
  // The device picked in a row, until it is saved.
  const [draft, setDraft] = useState<Record<string, string>>({})
  const change = useMutation({
    mutationFn: ({ id, device_id }: { id: string; device_id: string }) =>
      unwrap(api.PATCH('/mappings/{mapping_id}', { params: { path: { mapping_id: id } }, body: { device_id } })),
    onSuccess: (_m, { id }) => setDraft(({ [id]: _, ...rest }) => rest),
    onSettled: () => qc.invalidateQueries({ queryKey: ['mappings'] }),
  })

  if (mappings.isPending || devices.isPending) return <p>Loading…</p>
  if (mappings.isError) return <p className="error">Could not load mappings: {mappings.error.message}</p>

  const byId = new Map((devices.data ?? []).map((d: Device) => [d.device_id, d]))
  const rooms = groupBy(mappings.data, (m) => (m.device_id && byId.get(m.device_id)?.room) || 'Unknown room')
  const hl = map.scene ? highlighted(map.scene, selection) : new Set<string>()

  return (
    <section>
      {map.scene && (
        <div className="card map-card">
          <MapView scene={map.scene} selection={selection} onSelect={setSelection} label="Switches and devices on the home map" />
          <div className="map-legend muted">
            <span><i className="lg solid" /> Verified</span>
            <span><i className="lg dashed" /> Pending or Stale</span>
            <span><i className="lg caution" /> caution: not pressed directly</span>
          </div>
          <MapTag scene={map.scene} selection={selection} />
        </div>
      )}
      {[...rooms].map(([room, list]) => (
        <div key={room}>
          <h2>{room}</h2>
          <table className="table">
            <thead>
              <tr><th>Control</th><th>Device</th><th>Status</th><th>Confidence</th><th /></tr>
            </thead>
            <tbody>
              {list.map((m: Mapping) => {
                const d = m.device_id ? byId.get(m.device_id) : undefined
                const changed = (x: Mapping) => !!draft[x.mapping_id] && draft[x.mapping_id] !== x.device_id
                return (
                  <tr key={m.mapping_id} className={hl.has(m.mapping_id) ? 'hl' : undefined}>
                    <td>
                      <button type="button" className="linklike" onClick={() => setSelection({ kind: 'control', id: m.control_id })}>
                        {m.control_id}
                      </button>
                    </td>
                    <td>
                      <select
                        aria-label={`Device for ${m.control_id}`}
                        value={draft[m.mapping_id] ?? m.device_id ?? ''}
                        disabled={change.isPending}
                        onChange={(e) => setDraft((x) => ({ ...x, [m.mapping_id]: e.target.value }))}
                      >
                        {!m.device_id && <option value="">Which device is this?</option>}
                        {(devices.data ?? []).map((x) => (
                          <option key={x.device_id} value={x.device_id}>{x.name} · {x.room}</option>
                        ))}
                      </select>
                      {d?.risk === 'high' && <span className="badge high">high risk</span>}
                      {changed(m) && (
                        <button type="button" disabled={change.isPending} onClick={() => change.mutate({ id: m.mapping_id, device_id: draft[m.mapping_id] })}>
                          Save
                        </button>
                      )}
                    </td>
                    <td><span className={`badge ${m.status}`}>{m.status}</span></td>
                    <td>{Math.round(m.confidence * 100)}%</td>
                    <td className="actions">
                      <button disabled={m.status === 'Verified' || act.isPending} onClick={() => act.mutate({ id: m.mapping_id, verb: 'confirm' })}>
                        Confirm
                      </button>
                      <button disabled={m.status === 'Rejected' || act.isPending} onClick={() => act.mutate({ id: m.mapping_id, verb: 'reject' })}>
                        Reject
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      {change.isError && (
        <p role="alert" className="error">{change.error instanceof ApiError ? change.error.message : 'The device could not be changed.'}</p>
      )}
      <p className="muted">A changed device goes back to Pending: nothing runs it until it is checked or confirmed again. Asking for a new check needs an API route that does not exist yet.</p>
    </section>
  )
}

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return m
}
