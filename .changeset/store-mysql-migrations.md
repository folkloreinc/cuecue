---
'@cuecue/store-mysql': patch
---

The package ships its migrations: 0.0.45 left them out, so apps couldn't add the `extra` column from `node_modules`. An app runs them with its `MYSQL_*` variables (from the environment or its `.env`):

```bash
npx db-migrate up --migrations-dir node_modules/@cuecue/store-mysql/migrations --config node_modules/@cuecue/store-mysql/migrations/config.json -e prod
```

The package's README gives its settings and how to run the migrations.
