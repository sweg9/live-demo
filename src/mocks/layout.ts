import type { HomeLayout } from '../api/proposed'

// The mock home for GET /map (HomeLayout, since 0.6.0): centimetres, x to the right, y down, seen from above
// with the scan's own handedness (not mirrored).
//
// Measured from the map team's LiDAR scan of two dorm rooms (2026-11-24). A scan point (x, y)
// in metres, z up, maps to these coordinates with a = 34.25°:
//   X = 100 · (x·cos a − y·sin a + 2.5139)
//   Y = 100 · (7.6875 − x·sin a − y·cos a)
// Rooms, walls and furniture were drafted by tools/scan_to_plan.py and then straightened by
// hand against the scan points: noise and rounded scan corners became square walls, and the
// gaps in the walls are the doors. Only numbers are kept here; the photo texture stays on the
// owner's computer (C-05).
//
// Controls, devices and the dock are ESTIMATES placed for the demo, not measured: switches beside
// the doors and under the windows, press spots in the aisles. The map team replaces them with
// the positions they mark on the scan.

export const layout: HomeLayout = {
  rooms: [
    { room: 'Room A', x: 40, y: 520, w: 310, h: 312 },
    { room: 'Room B', x: 350, y: 520, w: 315, h: 312 },
    { room: 'Entry A', x: 40, y: 370, w: 218, h: 150 },
    { room: 'Entry B', x: 445, y: 380, w: 175, h: 140 },
    { room: 'Lobby', x: 258, y: 365, w: 187, h: 147 },
    // One straight hallway as wide as both rooms (the scan's bump and slanted edges were noise),
    // with the nook beside Entry B. Corrected with the map team on 2026-11-25.
    { room: 'Hallway', x: 30, y: 148, w: 640, h: 232 },
    { room: 'Hallway', x: 620, y: 380, w: 50, h: 140, label: false },
  ],
  walls: [
    [40, 832, 665, 832, 14], // window wall
    [40, 520, 40, 832, 12],
    [665, 520, 665, 832, 12],
    [350, 520, 350, 832, 10], // between the rooms
    [258, 520, 445, 520, 14], // the lobby's wall; rooms and entries have no wall between them (a boundary on the scan)
    [40, 370, 40, 520, 12], // Entry A, in line with Room A's outer wall
    [620, 380, 620, 520, 10],
    [258, 365, 258, 420, 10], // Entry A door to the lobby: 420–495
    [258, 495, 258, 520, 10],
    [445, 380, 445, 420, 10], // Entry B door to the lobby: 420–495
    [445, 495, 445, 520, 10],
    [30, 370, 258, 370, 18],
    [445, 380, 620, 380, 12],
    // hallway: open at both ends; the far wall is two pieces, open opposite the lobby, each with a
    // neighbour's door (the 90 cm gaps, drawn closed), as on the scan and the map team's model
    [30, 148, 96, 148, 12],
    [186, 148, 252, 148, 12],
    [445, 148, 512, 148, 12],
    [602, 148, 670, 148, 12],
    [670, 380, 670, 520, 12],
  ],
  furniture: [
    { kind: 'bed', x: 42, y: 522, w: 106, d: 206, h: 60 },
    { kind: 'wardrobe', x: 42, y: 728, w: 30, d: 98, h: 200 },
    { kind: 'desk', x: 72, y: 728, w: 76, d: 98, h: 75 },
    { kind: 'bed', x: 238, y: 522, w: 108, d: 200, h: 60 },
    { kind: 'desk', x: 238, y: 722, w: 84, d: 104, h: 75 },
    { kind: 'wardrobe', x: 322, y: 722, w: 24, d: 104, h: 200 },
    { kind: 'bed', x: 354, y: 522, w: 110, d: 204, h: 60 },
    { kind: 'wardrobe', x: 354, y: 726, w: 26, d: 100, h: 200 },
    { kind: 'desk', x: 380, y: 726, w: 84, d: 100, h: 75 },
    { kind: 'bed', x: 557, y: 522, w: 104, d: 214, h: 60 },
    { kind: 'desk', x: 557, y: 736, w: 86, d: 90, h: 75 },
    { kind: 'wardrobe', x: 643, y: 736, w: 18, d: 90, h: 200 },
    { kind: 'shelf', x: 42, y: 378, w: 62, d: 140, h: 190 },
    { kind: 'shelf', x: 575, y: 386, w: 42, d: 132, h: 120 },
  ],
  ceiling: 249,
  controls: [
    // The ceiling light switch, marked on the scan (2026-11-27): hallway wall inside Entry A, beside the door.
    { control_id: 'ctl-living-1', at: { x: 229, y: 379 }, press_spot: { x: 229, y: 428 }, spot_id: 'spot-living-1' },
    { control_id: 'ctl-living-2', at: { x: 243, y: 379 }, press_spot: { x: 243, y: 428 }, spot_id: 'spot-living-2' },
    { control_id: 'ctl-living-3', at: { x: 200, y: 832 }, press_spot: { x: 195, y: 775 }, spot_id: 'spot-living-3' },
    { control_id: 'ctl-bed-1', at: { x: 557, y: 785 }, press_spot: { x: 515, y: 785 }, spot_id: 'spot-bed-1' },
    { control_id: 'ctl-bed-strip', at: { x: 495, y: 832 }, press_spot: { x: 495, y: 775 }, spot_id: 'spot-bed-strip' },
    { control_id: 'ctl-bed-2', at: { x: 501, y: 386 }, press_spot: { x: 501, y: 435 }, spot_id: 'spot-bed-2' },
    // Room B's ceiling light switch, at the same place as Room A's: hallway wall inside Entry B, beside the door.
    { control_id: 'ctl-bed-ceiling', at: { x: 487, y: 386 }, press_spot: { x: 487, y: 435 }, spot_id: 'spot-bed-ceiling' },
  ],
  // The air purifier is left off the map (Dashboard owner, 2026-11-27); they stay in the lists.
  devices: [
    { device_id: 'dev-ceiling', at: { x: 195, y: 676 } },
    { device_id: 'dev-fan', at: { x: 175, y: 800 } },
    { device_id: 'dev-floor', at: { x: 228, y: 740 } },
    { device_id: 'dev-desk', at: { x: 600, y: 785 } },
    { device_id: 'dev-heater', at: { x: 530, y: 812 } },
    { device_id: 'dev-ceiling-b', at: { x: 508, y: 676 } }, // the middle of Room B, as dev-ceiling is in Room A
  ],
  dock: { x: 350, y: 440 },
}
