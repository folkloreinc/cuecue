# Changesets

Every pull request that changes a package adds a changeset, which says what changed for the apps that use it:

```bash
npx changeset
```

All `@cuecue/*` packages share one version. On `develop`, the Release workflow turns the pending changesets into a "Version packages" pull request; merging that pull request publishes the new version to npm. See "Releases" in the README.
