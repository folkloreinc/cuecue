---
'@cuecue/app': patch
'@cuecue/http': patch
---

Fixes found while adding tests:

- `@cuecue/app`: cueing a cue that doesn't exist no longer puts the app in the `cued` state (and tells the outputs so).
- `@cuecue/app`: `resetInteractions()` deletes the interactions with the memory store, not only with MySQL.
- `@cuecue/app`: `getInteractionsByUser()` and `getInteractionsByInteractionId()` find interactions by their id, so `GET /interactions` with `X-User-Id` returns that user's interactions instead of none.
- `@cuecue/http`: `POST /cues/define` takes an array of cues, as well as a single cue.
