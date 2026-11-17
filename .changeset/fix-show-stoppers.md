---
'@cuecue/app': patch
'@cuecue/http': patch
'@cuecue/osc': patch
'@cuecue/pubnub': patch
'@cuecue/socketio': patch
'@cuecue/store-mysql': patch
---

Fixes that keep a show running:

- `@cuecue/app`: an output that fails no longer stops the app, nor the other outputs: the failure is logged with the new `logger` option (`console` by default). A command from an input that fails is logged too.
- `@cuecue/app`: `reset` and `resetInteractions` after `end` are ignored instead of stopping the app.
- `@cuecue/app`: a cue's `duration` stops when another cue starts: it no longer uncues the next cue. The duration is a timer instead of a check every 10 ms, and `after_duration: 'next'` goes to the next cue of the session, defined cues included.
- `@cuecue/osc`, `@cuecue/pubnub`, `@cuecue/http`, `@cuecue/socketio`: outputs return the promise of `cue()`, `interact()` and the like, so that the app can catch their failures. PubNub's failed publishes reject with an `Error`.
- `@cuecue/pubnub`, `@cuecue/socketio`: inputs emit the command that `transformCommand` returns, not the original one.
- `@cuecue/socketio`: `ServerOutput` sends to the namespace that `transformCommand` returns.
- `@cuecue/osc`: inputs and outputs can be destroyed before they are initialized.
- `@cuecue/store-mysql`: the store uses a pool of one connection, which replaces a lost connection, and a connection error no longer stops the process. `destroy()` works, and `autoConnect` connects after `init()`.
