# live-demo

The resident's dashboard for NOVA (Vite, React 18, TypeScript, TanStack Query; wiki: [Stack > Web app](https://sweg9.github.io/docs/overview/stack)). It talks only to the `backend-server` API, typed from its spec.

## Run

```bash
npm install          # also generates src/api/schema.d.ts and public/mockServiceWorker.js
npm run dev          # http://localhost:5173, answered by the browser mock (MSW)
npm run dev:real     # the same app against a real server; /api is proxied to VITE_API_TARGET
npm test             # Vitest, with the same mock
npm run build
```

- **Mock.** `src/mocks/` answers every route of the spec in the browser with demo data, so the app runs with no server. Nothing leaves the page. A reload starts the data again. It plays a bedtime scenario over the live WebSocket in the hub's order and shapes (backend-server 0.5.0), and acts like the hub for the emergency stop, Try again, Leave it, the move order and the yes-or-no answer to a situation. Demo password: `nova-demo` (mock only).
- **API notes.** What was adopted in 0.5.0 and what is still proposed (`GET /map`): [docs/proposed-api.md](docs/proposed-api.md). The live event types are in `src/api/proposed.ts`, taken from the spec.
- **Real server.** `VITE_API_TARGET` defaults to `http://127.0.0.1:8000`: the server and the hub run on this computer as [backend-server's README](https://github.com/sweg9/backend-server#run) says (`--demo-scenarios` plays the demo scenarios). The proxy strips `/api`, like the ingress. For a cluster, include its `/api`: `VITE_API_TARGET=https://sweg9.localhost:8443/api`. Put a different target in `.env.local`, which is never committed (C-10).
- **API types.** `api/backend-server.yaml` is a copy of `backend-server/openapi/backend-server.yaml`, the team's contract. `npm run api:sync` copies it again from a sibling checkout and regenerates the types.

## Screens

| Screen | State | Requirements |
|---|---|---|
| Sign-in, sign-out | Built (`/me`, `/login`, `/logout`) | C-10 |
| Safety bar: emergency stop and pause, on every screen | Built. Pause reads its state from `GET /proactive` | FR-10, FR-06, C-04, C-06 |
| Home: situation, robot, runs, map with the robot and its route | Built (`situation`, `robot`, `visits`, `run.progress`) | FR-05, FR-09 |
| Situation → run: plan, yes or no when the hub asks, wireless result per device, visit order, press progress | Built | FR-05, FR-06, FR-07, FR-09 |
| Failures: Try again, Leave it | Built (`resolution` of each run) | C-09, C-08 |
| Mappings: by room and on the map; confirm or reject | Built. Change device and new check wait on API routes; the map waits on `GET /map` | FR-02, C-08 |
| Send the robot: ordered stops on the map | Built (`POST /robot/route`, `robot.route`) | C-04, C-08 |
| History & stats | Built from `GET /runs` | FR-12, C-07 |

- No live camera view: video never leaves the home (C-05).

## Map: 2D plan and 3D model

The map switches between 2D and 3D. Both draw the same data (`src/map/model.ts`), so marks, links and the robot sit on the same spots.

- **Plan.** Rooms, straight walls (gaps are doors) and furniture boxes in `src/mocks/layout.ts`, measured from the map team's LiDAR scan of 2026-11-24 and straightened by hand. Switch and device positions are estimates until the map team marks them.
- **3D sources.** `Model` (default) builds clean walls, floors and furniture from the plan. `Scan` shows the raw LiDAR shape, `public/scan/home-shape.glb` (no texture). `Photo` shows the textured scan, which stays in `local/` on the owner's computer: it is git-ignored, served only by the dev server and never built into `dist/` (C-05).
- **Rebuilding from a new scan** (OBJ + MTL + JPG):

  ```bash
  node tools/scan-to-glb.mjs <scan.obj>       # public/scan/home-shape.glb and local/scan/home-textured.glb
  uv run --with numpy --with scipy --with matplotlib python -I tools/scan_to_plan.py <scan.obj> plan.json --debug plan.png
  ```

  `scan_to_plan.py` gives a draft of walls and furniture; check it against `plan.png` and correct it by hand before it goes into the layout. The scan itself never goes into this repository.

## Skills and standards

`skills/` is a git submodule of [harness](https://github.com/sweg9/harness). It holds the shared standards and skills for this project. Claude Code finds the skills through `.claude/skills`.

```bash
git clone --recurse-submodules <this repo>
git submodule update --init            # in a repo that is already cloned
git submodule update --remote skills   # move to the latest skills, then commit
```
