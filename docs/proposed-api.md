# API changes the dashboard needs

For: the backend-server owner, the mock-server owner and the map owner.
Status: most of the first proposal (2026-11-24) was adopted in backend-server 0.5.0 and the home map in 0.6.0 (`openapi/backend-server.yaml`), merged with `openapi/dashboard-proposed.yaml`. That spec is the contract now. What is left is under [Still proposed](#still-proposed).

The browser mock (`src/mocks/`) answers every route of 0.6.0 that the dashboard calls, with the same shapes and in the same event order as the hub's orchestrator.

## Adopted in 0.5.0

| What | In the spec | Rules |
|---|---|---|
| Try again | `POST /runs/{run_id}/retry` → `202 Choice {run_id, choice, retry_run_id}`; `409` `not_failed`, `already_chosen`, `robot_busy`, `not_verified` at once | C-09, C-08, C-04 |
| Leave it | `POST /runs/{run_id}/leave` → `200 Choice` (`retry_run_id: null`) | C-09 |
| The resident's choice, kept | `Run.resolution` `{choice, retry_run_id}` or `null`; `Run.retry_of`; `Run.situation_id`. Failures lists runs with `resolution == null`; History links a retry both ways | C-07, C-09 |
| Move order | `POST /robot/route {stops}` (spot, control or device ids) → `202 {route_id, stops}`; `404 unknown_stop`; `409 robot_busy`, `not_verified`, `no_press_spot`; live `robot.route` | C-04, C-08 |
| Pause state | `GET /proactive` → `{paused}` | C-06 |
| Situations and their plan | `GET /situations`, `/situations/{id}`, approve and dismiss; live `situation` (the whole Situation with `plan[]`) | FR-05, FR-06 |
| Visits | `GET /visits`; live `visits` `{visits: Visit[]}` with `reason` and `status` | FR-07, FR-09 |
| The robot | `GET /robot`; live `robot` (state, spot, task with `step` and `text`, plan, RAL) | FR-09, FR-10 |
| Run steps | live `run.progress` = `RunProgress`: `step` codes (`decide` `wireless` `queued` `move` `gate` `press` `check`), plain `text`, and the outcomes `wireless`, `gate`, `answer`, `reason` | FR-07, FR-08, C-07 |
| Notifications | live `notification` = `Notification` (`level`, `topic`, `message`, `choices`, ids) | C-03, C-07 |
| High-risk devices | a `notification` (`high_risk_run`) after every run, whatever the result | C-03 |
| Order | a run's `run.progress` comes before the `robot` event of the same step | — |

The dashboard reads `GET /situations`, `/visits` and `/robot` again when the socket opens, so a reload or a reconnect does not start from an empty screen.

## Adopted in 0.6.0

| What | In the spec | Rules |
|---|---|---|
| Home map | `GET /map` → `HomeLayout` (the dashboard's shape): centimetres on the floor, rooms, walls, furniture, each control's position and press spot with its `spot_id`, the dock. Numbers only, no photos. The positions of the demo home are estimates until the map team marks them on the scan | FR-09, C-05 |
| Change the device of a mapping | `PATCH /mappings/{mapping_id} {device_id}` → `200 Mapping`, back to `Pending`; the `mapping` event carries `previous_device_id`. Not on the Devices screen yet | FR-02, C-08 |
| Hub error | `notification` topic `task_failed` with `task`: the hand stopped and the runs going on were cancelled | C-04 |

## Still proposed

| What | Why | Owner, and what must happen first |
|---|---|---|
| Trigger `resident` | A run the resident started from the app (Try again) has no trigger of its own; 0.5.0 keeps the old run's trigger and adds `retry_of` instead | Harness first: `data-model.md` has only `sensor` `time` `routine` (C-02). Maybe not needed now that `retry_of` exists |
| `GET /stats` | History & stats. Today the Dashboard reads `GET /runs?limit=100` and counts in the browser, so the stats cover only the newest 100 runs (the screen says so) and every visit downloads the runs. The hub has every run in SQLite and can count them all | Backend: adopt the `Stats` schema already drafted in `openapi/dashboard-proposed.yaml` (runs, results, wireless and press rates, channels, failure reasons, top devices, mappings by status, verified ratio): the same numbers the screen shows, so only `src/pages/stats.ts` changes. Team view (2026-11-25): keep counting from `/runs` for the demo, add the route when the runs grow |
| Check a mapping again | Devices screen. `dashboard-proposed.yaml` has `POST /mappings/{id}/recheck` | Backend: adopt it in the spec |

## To decide as a team

- **Sign-in with Kakao or Naver.** Easier for residents and for several family members. Against it today: the hub checks the password and keeps the sessions, and the server keeps no records (decision of 2026-11-20), so OAuth means moving that to the server; every sign-in is seen by a third party (C-05); the redirect URL needs the domain, which is still open. The sign-in screen is built so a provider button can be added later.
- **Domain and TLS certificate**, which OAuth and the real deployment both need.
- **Encrypting the web app's requests for the enclave.** If the browser encrypts for the Nitro Enclave, the spec needs a route for the enclave's public key with its attestation document, the envelope format, and the list of routes it covers. The browser must check the attestation itself, or the server in between could hand it another key.

## Map coordinates (for the map owner)

The rooms in `src/mocks/layout.ts` come from the LiDAR scan of 2026-11-24. To turn a point (x, y) of that scan (metres, z up) into dashboard coordinates (cm, y down, seen from above, not mirrored), with a = 34.25°:

```
X = 100 · (x·cos a − y·sin a + 2.5139)
Y = 100 · (7.6875 − x·sin a − y·cos a)
```

The 3D view uses the same frame in metres: (X/100, height above the floor, Y/100), with the floor at scan z = −1.2989. `tools/scan-to-glb.mjs` bakes this into the GLB, so a point marked on the scan lands on the same spot in 2D and 3D. Controls, devices, spots and the dock in the mock are estimates until they are marked on the scan.
