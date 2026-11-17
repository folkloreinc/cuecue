---
'@cuecue/app': patch
---

Commands sent while a transition runs are no longer lost:

- `start`, `stop`, `end`, `cue`, `uncue`, `init` and `destroy` run one after the other, in the order they come: a second `cue` sent while the first one runs now waits for it instead of being dropped, with a promise that never settled.
- Transitions no longer wait for the outputs: the `cue`, `uncue` and `state` messages are sent without waiting for an answer, as the other messages already were, so a slow or unreachable output (PubNub takes 15 s to fail) doesn't hold the next commands. Each output still gets them in order; failures are still logged.
