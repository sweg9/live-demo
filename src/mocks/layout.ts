import type { HomeLayout } from '../api/proposed'

// A small two-room home for the browser mock (the proposed GET /map). Centimetres.
// Controls sit on walls; each press spot is where the cart stands facing it.

export const layout: HomeLayout = {
  rooms: [
    { room: 'Living room', x: 0, y: 0, w: 600, h: 420 },
    { room: 'Bedroom', x: 600, y: 0, w: 420, h: 420 },
  ],
  controls: [
    { control_id: 'ctl-living-1', at: { x: 0, y: 190 }, press_spot: { x: 70, y: 190 } },
    { control_id: 'ctl-living-2', at: { x: 0, y: 250 }, press_spot: { x: 70, y: 250 } },
    { control_id: 'ctl-living-3', at: { x: 330, y: 0 }, press_spot: { x: 330, y: 70 } },
    { control_id: 'ctl-bed-1', at: { x: 1020, y: 160 }, press_spot: { x: 950, y: 160 } },
    { control_id: 'ctl-bed-strip', at: { x: 730, y: 420 }, press_spot: { x: 730, y: 350 } },
    { control_id: 'ctl-bed-2', at: { x: 760, y: 0 }, press_spot: { x: 760, y: 70 } },
  ],
  devices: [
    { device_id: 'dev-ceiling', at: { x: 300, y: 210 } },
    { device_id: 'dev-fan', at: { x: 150, y: 340 } },
    { device_id: 'dev-floor', at: { x: 520, y: 90 } },
    { device_id: 'dev-desk', at: { x: 920, y: 280 } },
    { device_id: 'dev-heater', at: { x: 830, y: 340 } },
    { device_id: 'dev-purifier', at: { x: 900, y: 70 } },
  ],
  dock: { x: 560, y: 380 },
}
