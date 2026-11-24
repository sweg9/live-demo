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

- **Mock.** `src/mocks/` answers every route of the spec in the browser with demo data, so the app runs with no server. Nothing leaves the page. A reload starts the data again.
- **Real server.** `VITE_API_TARGET` defaults to `https://sweg9.localhost:8443` (a local k3d cluster). Put a different target in `.env.local`, which is never committed (C-10).
- **API types.** `api/backend-server.yaml` is a copy of `backend-server/openapi/backend-server.yaml`, the team's contract. `npm run api:sync` copies it again from a sibling checkout and regenerates the types.

## Screens

| Screen | State | Requirements |
|---|---|---|
| Safety bar: emergency stop and pause, on every screen | Built | FR-10, FR-06, C-04, C-06 |
| History & stats | Built from `GET /runs` | FR-12, C-07 |
| Mappings: confirm or reject, by room | Built | FR-02, C-08 |
| Failures | Lists failed, unsure and cancelled runs. Try again and Leave it wait on an API route | C-09 |
| Now, Situation → run, Send the robot | Placeholders that list what they wait on | FR-05, FR-07, FR-09 |

No live camera view: video never leaves the home (C-05).

## Skills and standards

`skills/` is a git submodule of [harness](https://github.com/sweg9/harness). It holds the shared standards and skills for this project. Claude Code finds the skills through `.claude/skills`.

```bash
git clone --recurse-submodules <this repo>
git submodule update --init            # in a repo that is already cloned
git submodule update --remote skills   # move to the latest skills, then commit
```
