---
'@cuecue/cli': patch
---

`cuecue osc-output` works again: it imported an `OscOutput` that `@cuecue/osc` doesn't export, and never opened its OSC client. It now sends the message, prints it, and exits with an error code when sending fails.
