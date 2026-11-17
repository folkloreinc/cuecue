# cuecue

Cuecue runs live shows: an app holds a definition of cues and a session, takes commands from inputs (HTTP, OSC…) and sends cues, interactions and its state to outputs (Pingpong, OSC, HTTP…). [COMMANDS.md](COMMANDS.md) lists the commands.

## Packages

| Package               |                                                                         |
| --------------------- | ----------------------------------------------------------------------- |
| `@cuecue/app`         | The application, with a memory store                                    |
| `@cuecue/core`        | Base classes of inputs, outputs and plugins                             |
| `@cuecue/http`        | HTTP input with an API (`POST /commands`, `/cues`…) and HTTP output     |
| `@cuecue/osc`         | OSC input and output                                                    |
| `@cuecue/pingpong`    | Output to a [Pingpong](https://github.com/folkloreinc/pingpong) channel |
| `@cuecue/pubnub`      | PubNub input and output                                                 |
| `@cuecue/socketio`    | Socket.IO inputs and outputs                                            |
| `@cuecue/store-mysql` | MySQL store, with its migrations                                        |
| `@cuecue/cli`         | The `cuecue` command                                                    |

They need Node 22 or later.

## Development

Node 24 (`.nvmrc`), npm workspaces, changesets.

```bash
npm install
npm run build          # build every package (Rollup and Babel, to CommonJS)
npm test               # Vitest
npm run lint           # ESLint
npm run format         # Prettier
```

Tests sit next to the code (`*.test.js`) and import the packages' sources. `test/packages.test.js` checks the builds, so run `npm run build` first. The tests of `@cuecue/pingpong` start a real Pingpong server, which needs Node 24: they are skipped on Node 22. The tests of `@cuecue/store-mysql` against MySQL run when `MYSQL_TEST_HOST`, `MYSQL_TEST_PORT`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD` and `MYSQL_TEST_DB` name a migrated database (`npm run migrate:up -w @cuecue/store-mysql`), which they empty. CI runs the format check and the lint, builds and tests on Node 22 and 24, and tests the MySQL store on MySQL 8.4.

The examples run with Babel: `npm run example:server`.

## Releases

All packages share one version. They are published from GitHub Actions with [changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers), as in panneau-js and Pingpong: no npm token, and nothing is published from a local machine.

1. Every pull request that changes a package adds a changeset (`npx changeset`): what changed, for the apps that use it. CI checks that there is one.
2. On every push to `develop`, the Release workflow (`.github/workflows/release.yml`) turns the pending changesets into a "Version packages" pull request: new versions and changelogs.
3. Before merging it, an owner of the `@cuecue` npm scope configures trusted publishing for the packages about to be published, from that pull request's branch. A configuration expires after 2 days without a publish:

    ```bash
    scripts/trust-packages.sh
    ```

4. Merging the "Version packages" pull request publishes: the workflow builds, tests and packs without access to npm, then a separate job, in the `npm` environment, publishes the tarballs and tags the versions.

npm trusts the workflow by its file name and its `npm` environment: renaming either breaks publishing. The repository must allow GitHub Actions to create pull requests (Settings → Actions → General).
