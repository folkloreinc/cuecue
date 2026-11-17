---
'@cuecue/store-mysql': patch
---

The MySQL store keeps the fields that have no column of their own (a cue's `interaction`, `duration` or `after_duration`, an interaction's `cueId`…) in a new `extra` JSON column, and finds items by them. They come back as fields of the item. Cues with these fields failed with "Unknown column", and `getInteractionsByCue()` failed too.

Run the migrations to add the column: `npm run migrate:up -w @cuecue/store-mysql` in this repository, or `db-migrate up` with the package's migrations. Without it, the store says so when an item has such a field.
