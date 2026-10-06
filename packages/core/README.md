# @lustefaniak/pascal-studio-core

Shared plumbing for the [Pascal Studio plugins](../../README.md). Not a plugin by itself; the camera,
library and IKEA plugins depend on it.

- `api.ts` — the studio worker client (`WORKER_ORIGIN`, library, IKEA, render jobs)
- `rooms.ts` — the project's room list, fetched from the worker (also exported as `./rooms`, which
  pulls in nothing heavy, for manifest modules)
- `store.ts` — a zustand store bridging panels and the R3F canvas
- `ui.tsx` — `usePlaceModel`, scene usage counts and panel styling

## The worker

The panels need a small local HTTP service, the **studio worker**, for what a browser plugin may
not do: serve GLBs from `localhost` (Pascal accepts no other model host), proxy the IKEA catalog (no
CORS headers), and write a finished render to disk. It listens on `http://127.0.0.1:8899`; a host
can point elsewhere with `globalThis.__STUDIO_WORKER__`. The port is baked into `asset.src` of every
model a panel places, so keep it stable.

| method | path | purpose |
|---|---|---|
| GET | `/studio/health` | liveness |
| GET | `/studio/project` | project lists: `{ rooms: [{ id, label }] }` for the camera inspector |
| GET | `/studio/library` | `{ models: LibraryModel[], fingerprint }` |
| GET | `/studio/library/watch?since=<fingerprint>` | long poll, returns when the model set changes |
| GET | `/studio/ikea/search?q=` | catalog hits with variants |
| GET | `/studio/ikea/product?id=` | set contents and accessories |
| POST | `/studio/ikea/import` | `{ id, name, quality }` → downloads and measures a model |
| GET | `/studio/commands[?role=headless]` | long poll for the next render job |
| POST | `/studio/commands/complete` | `{ requestId, error }` |
| POST | `/studio/shots` | PNG body; headers `x-studio-name`, `x-studio-request`, `x-studio-meta` |
| GET | `/<path>.glb` | model files |

### Headless rendering

A tab opened with `?studio-renderer=1` polls with `role=headless`. A worker can start such a tab in
headless Chrome and hand render jobs only to it, so no visible editor tab is needed and the canvas
size is under the worker's control. Headless Chrome on macOS renders on the GPU (ANGLE on Metal).
Send one camera per job to the headless tab; several cameras in one job have come back as copies of
the first frame there.

A headless tab sees scene edits only through the editor's live event stream
(`/api/scenes/<id>/events`). Stock Pascal feeds that stream from its MCP tools only; a graph written
over `PUT /api/scenes/<id>` reaches open tabs only if the host appends a scene event for it.
