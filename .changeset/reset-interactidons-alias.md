---
'@cuecue/app': patch
---

`resetInteractidonsByIds()`, the misspelled name that 0.0.45 renamed to `resetInteractionsByIds()`, works again for the apps that call it. It is deprecated: it warns once with `logger.warn()`, and calls `resetInteractionsByIds()`.
