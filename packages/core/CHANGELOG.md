# @cuecue/core

## 0.0.46

No changes in this release.

## 0.0.45

No changes in this release.

## 0.0.44

### Patch Changes

- 2a19745: - New `@cuecue/pingpong`: an output that publishes the app's commands to a Pingpong channel through its signed HTTP API, in order. A failed publish is logged and never rejects.
    - `@cuecue/http`: `POST /commands` sends any command to the app, as `{ "command": "start", "args": [] }`. Inputs get a `command()` method.
    - `@cuecue/app`: `interact()` ignores interactions outside a session.
    - `@cuecue/osc`: `node-osc` 9.
    - All packages need Node 22 or later. `uuid` is replaced with `crypto.randomUUID()`, `axios` goes to 1 and `db-migrate` to 1.
