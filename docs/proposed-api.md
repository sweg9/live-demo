# API changes the dashboard needs

For: the backend-server owner, the mock-server owner and the map owner.
Status: proposal. Nothing here is in `backend-server/openapi/backend-server.yaml` yet.

The dashboard already uses these shapes. The browser mock (`src/mocks/`) answers them, and the types are in [`src/api/proposed.ts`](../src/api/proposed.ts). If a shape is accepted as it is, the dashboard switches to the real server with no code change. If it changes, the TypeScript compiler shows every screen to fix.

## New HTTP routes

| Route | Answer | Why | Rules |
|---|---|---|---|
| `POST /runs/{run_id}/retry` | `202 {run_id, retry_run_id}`. `409` if the run succeeded, was already resolved, the robot is busy, or the device has no `Verified` mapping | Failures screen: Try again | C-09 (the resident chooses; the system never retries alone), C-08, C-04 (a new gate before the press) |
| `POST /runs/{run_id}/leave` | `200` with the run | Failures screen: Leave it | C-09 |
| `GET /runs` field `resolution` | `retried` or `left`, absent until the resident chooses | The Failures list shows only open runs; History shows the choice | C-07 |
| `POST /robot/route` `{stops: [device_id]}` | `202 {route_id}`. `409` while the robot is busy or a stop has no `Verified` mapping | Send the robot: "go here", "stop here, then go there". Nothing is pressed | C-04 (gate before every leg), C-08 |
| `GET /proactive` | `{paused}`, the same as `PUT /proactive` saves | Today the app cannot show whether automation is paused until the resident presses a button | C-06 |
| `GET /map` | `HomeLayout`: rooms, control and device positions with press spots, dock (cm, y down) | Map on Now, Mappings and Send the robot | Owned by the map work; no photos in it (C-05) |

## Live events on `/api/ws/app`

The server pushes `{kind, data}`. `kind` is in the spec; `data` is untyped today.

| `kind` | `data` | New? |
|---|---|---|
| `situation` | `situation_id`, `trigger`, `summary` (fixed template, C-07), `at` | New kind |
| `routine` | the `Routine`, plus `situation_id` | New field |
| `run.progress` | `run_id`, `situation_id`, `device_id`, `stage` (S4 to S6), `step` (`decide` `wireless` `queued` `move` `gate` `press` `check`), and when they apply `channel`, `wireless` (`success` `failure` `no_wireless`), `answer` (`yes` `no` `unsure`), `gate` (`pass` `fail`), `reason` | Typed `data` |
| `run.result` | the `Run`, plus `situation_id` | New field |
| `robot.plan` | `situation_id`, `visits: [{device_id, run_id, why}]`, `why` = `wireless_failed` `no_wireless` `resident_asked` | New kind |
| `robot.status` | `state` (as `RalStatus.state`), `device_id`, `step`, `room` | New kind. Today `hub.status` stops at the server |
| `robot.route` | `route_id`, `stops`, `reached`, `state` (`moving` `done` `cancelled`), `reason` | New kind |
| `notification` | `text` | Typed `data` |

Order matters in one place: send a run's `run.progress` before the `robot.status` that reports the same step, so the robot card never shows an older step than the run.

## Behavior the mock follows (please keep on the hub)

- **Emergency stop.** Every open run ends with `run.result` `cancelled`, `reason: "emergency stop"`. An open move order ends with `robot.route` `cancelled`. Then `robot.status` `stopped`, at the place it stopped.
- **High-risk devices.** A `notification` after every run, whatever the result (C-03).
- **Unsure.** Checked once more, then the run ends `unsure` with no second press (C-09).

## Vocabulary change (harness first, C-02)

- `trigger` needs `resident` for a run the resident started from the app (Try again). `data-model.md` has only `sensor` `time` `routine`.

## Not built yet: no route to call

- Change the device of a mapping, and ask for a new check of a mapping (Mappings screen).

## To decide as a team

- **Sign-in with Kakao or Naver.** Easier for residents and for several family members. Against it today: the hub checks the password and keeps the sessions, and the server keeps no records (decision of 2026-11-20), so OAuth means moving that to the server; every sign-in is seen by a third party (C-05); the redirect URL needs the domain, which is still open. The sign-in screen is built so a provider button can be added later.
- **Domain and TLS certificate**, which OAuth and the real deployment both need.

## Map coordinates (for the map owner)

The rooms in `src/mocks/layout.ts` come from the LiDAR scan of 2026-11-24. To turn a point (x, y) of that scan (metres, z up) into dashboard coordinates (cm, y down), with a = 34.25°:

```
X = 100 · (x·cos a − y·sin a + 2.514)
Y = 100 · (x·sin a + y·cos a + 0.906)
```
 Controls, devices and the dock in the mock are estimates until they are marked on the scan.
