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

Node 24 (`.nvmrc`), npm workspaces, lerna.

```bash
npm install
npm run build          # build every package (Rollup and Babel, to CommonJS)
npm test               # Vitest
npm run lint           # ESLint
npm run format         # Prettier
```

Tests sit next to the code (`*.test.js`) and import the packages' sources. `test/packages.test.js` checks the builds, so run `npm run build` first. The tests of `@cuecue/pingpong` start a real Pingpong server, which needs Node 24: they are skipped on Node 22. CI runs the format check and the lint, then builds and tests on Node 22 and 24.

The examples run with Babel: `npm run example:server`.

## Releases

All packages share one version (`lerna.json`). They are published from GitHub Actions with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers), never from a local machine:

1. On a branch, set the new version and open a pull request to `develop`:

    ```bash
    npx lerna version 0.0.44 --no-git-tag-version --no-push
    npm install --package-lock-only
    ```

2. Once it is merged, an owner of the `@cuecue` npm scope configures trusted publishing for the packages about to be published (those whose version isn't on npm yet). A configuration expires after 2 days without a publish, so do it right before the next step:

    ```bash
    scripts/trust-packages.sh
    ```

3. Tag the merge commit with the version and push the tag:

    ```bash
    git tag v0.0.44 && git push origin v0.0.44
    ```

    The Release workflow (`.github/workflows/release.yml`) checks that the tag is the version, builds, tests, and publishes the packages whose version isn't on npm yet. npm trusts this workflow by its file name and its `npm` environment: renaming either breaks publishing.
