import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Device, type Mapping } from '../api/client'
import { MapTag } from '../map/HomeMap'
import { MapView } from '../map/MapView'
import { highlighted, type Selection } from '../map/model'
import { useScene } from '../map/useScene'

// FR-02, C-06, C-08: the resident confirms or rejects a mapping. Only Verified mappings are used,
// so the status is always shown next to the link. Selecting a switch on the map (or its row)
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
            <span><i className="lg solid" /> confirmed</span>
            <span><i className="lg dashed" /> guess</span>
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
                return (
                  <tr key={m.mapping_id} className={hl.has(m.mapping_id) ? 'hl' : undefined}>
                    <td>
                      <button type="button" className="linklike" onClick={() => setSelection({ kind: 'control', id: m.control_id })}>
                        {m.control_id}
                      </button>
                    </td>
                    <td>
                      {d ? d.name : 'Which device is this?'}
                      {d?.risk === 'high' && <span className="badge high">high risk</span>}
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
      <p className="muted">Changing the device and asking for a new check need API routes that do not exist yet.</p>
    </section>
  )
}

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return m
}
