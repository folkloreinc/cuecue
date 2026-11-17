# @cuecue/store-mysql

A Cuecue store that keeps the sessions, cues and interactions in MySQL, instead of the app's memory store.

```js
import Application from '@cuecue/app';
import MysqlStore from '@cuecue/store-mysql';

const app = new Application(definition, { store: new MysqlStore() });
app.start();
```

## Settings

| Option            | Environment variable | Default     |                                                                  |
| ----------------- | -------------------- | ----------- | ---------------------------------------------------------------- |
| `host`            | `MYSQL_HOST`         | `localhost` | The MySQL server                                                 |
| `port`            | `MYSQL_PORT`         | `3306`      |                                                                  |
| `user`            | `MYSQL_USER`         |             |                                                                  |
| `password`        | `MYSQL_PASSWORD`     |             |                                                                  |
| `database`        | `MYSQL_DB`           |             |                                                                  |
| `connectionLimit` |                      | `1`         | The connections of the pool. One keeps the queries in order      |
| `autoConnect`     |                      | `false`     | Checks that the database answers when the app starts, or rejects |

The options passed to `new MysqlStore({ … })` win over the environment variables.

## Migrations

The tables (`sessions`, `cues`, `interactions`) come from the [db-migrate](https://db-migrate.readthedocs.io) migrations in `migrations/`, which the package ships. An app runs them from `node_modules`, with the same `MYSQL_*` variables as the store (from the environment or a `.env` file in the current directory):

```bash
npx db-migrate up --migrations-dir node_modules/@cuecue/store-mysql/migrations --config node_modules/@cuecue/store-mysql/migrations/config.json -e prod
```

Run it again after each update of the package: it only runs the new migrations. `db-migrate down` (one migration) and `db-migrate reset` (all of them) take the same options. An app can keep it as a script in its `package.json`:

```json
{
    "scripts": {
        "migrate": "db-migrate up --migrations-dir node_modules/@cuecue/store-mysql/migrations --config node_modules/@cuecue/store-mysql/migrations/config.json -e prod"
    }
}
```

The fields of an item that have no column of their own (a cue's `duration`, an interaction's `cueId`…) go in the `extra` JSON column, added in 0.0.45 by `20261117120000-extra.js`. Without that migration, the store throws when an item has such a field.

In this repository, `npm run migrate:up -w @cuecue/store-mysql` runs them with the `.env` at the root.
