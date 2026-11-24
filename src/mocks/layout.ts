import type { HomeLayout } from '../api/proposed'

// The mock home for the proposed GET /map, in centimetres, y down.
//
// Rooms: measured from the map team's LiDAR scan of two dorm rooms (2026-11-24): the mesh
// was turned 34.25° so its walls are axis-aligned, and the rectangles were read from the
// wall points. Only these numbers are kept here: the scan and its photo texture stay out
// of this public repository (C-05).
//
// Controls, devices and the dock are ESTIMATES placed for the demo, not measured. The map
// team replaces them with the positions they mark on the scan.

export const layout: HomeLayout = {
  rooms: [
    { room: 'Room A', x: 40, y: 30, w: 305, h: 310 },
    { room: 'Room B', x: 360, y: 30, w: 305, h: 310 },
    { room: 'Entrance', x: 90, y: 340, w: 560, h: 160 },
    { room: 'Hallway', x: 10, y: 500, w: 600, h: 210 },
  ],
  controls: [
    { control_id: 'ctl-living-1', at: { x: 255, y: 340 }, press_spot: { x: 255, y: 280 } },
    { control_id: 'ctl-living-2', at: { x: 215, y: 340 }, press_spot: { x: 215, y: 280 } },
    { control_id: 'ctl-living-3', at: { x: 300, y: 30 }, press_spot: { x: 300, y: 95 } },
    { control_id: 'ctl-bed-1', at: { x: 665, y: 210 }, press_spot: { x: 600, y: 210 } },
    { control_id: 'ctl-bed-strip', at: { x: 560, y: 30 }, press_spot: { x: 560, y: 95 } },
    { control_id: 'ctl-bed-2', at: { x: 400, y: 340 }, press_spot: { x: 400, y: 280 } },
  ],
  devices: [
    { device_id: 'dev-ceiling', at: { x: 190, y: 185 } },
    { device_id: 'dev-fan', at: { x: 100, y: 270 } },
    { device_id: 'dev-floor', at: { x: 290, y: 140 } },
    { device_id: 'dev-desk', at: { x: 610, y: 120 } },
    { device_id: 'dev-heater', at: { x: 500, y: 70 } },
    { device_id: 'dev-purifier', at: { x: 430, y: 160 } },
  ],
  dock: { x: 350, y: 440 },
}
