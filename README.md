# TEST FE WITH DB — Multi-database connectivity checker

A Nuxt Web Service that checks **one configured database engine**: PostgreSQL, MySQL, MariaDB, or Redis. The hero remains `TEST FE WITH DB`, followed by three accessible sample-data tabs. This branch is `multi-db-check`; the repository's `static` branch has no server-side database checker.

## Behavior

- Green **Connected** means the selected engine answered its read-only probe. Red **Not connected** means configuration, authentication, connectivity, or engine identification failed.
- The card displays the selected engine, detected version when available, database identifier, latency, and a sanitized message. Versions are informational; PostgreSQL is no longer restricted to version 16.
- Checks run initially, every 30 seconds, and when **Check again** is clicked. Overlapping requests share one in-flight check; completed results are not cached.
- Each probe has a five-second application deadline. Driver connection/query limits are shorter than that deadline. Connections are fresh per probe, closed after each result, cancelled on timeout, and cleaned up on application shutdown. Redis does not reconnect indefinitely or queue offline commands.
- Service inventory, Database workloads, and Deployment events contain eight generated rows each. These rows are returned by the server and are **not stored in any database**.
- There are no migrations, application-data writes, seeds, arbitrary query console, Queue, Worker, or Cron dependencies.

## Runtime configuration

Select exactly one engine; credentials remain on the server.

| `DB_ENGINE` | Required connection variable | Example |
| --- | --- | --- |
| `postgresql` (default) | `DATABASE_URL` | `postgresql://user:password@host:5432/database` |
| `mysql` | `DATABASE_URL` | `mysql://user:password@host:3306/database` |
| `mariadb` | `DATABASE_URL` | `mysql://user:password@host:3306/database` |
| `redis` | `REDIS_URL` | `redis://user:password@host:6379/0` or `rediss://user:password@host:6379/0` |

`postgres://` is also accepted. Leaving `DB_ENGINE` unset preserves existing PostgreSQL configuration. Engine values are trimmed and case insensitive. Redis ignores `DATABASE_URL`; SQL engines ignore `REDIS_URL`. Redis defaults to logical database index `0`. MySQL and MariaDB require a database name in the URL and are distinguished using the server version string. A mismatch is reported as an unsuccessful check.

URL-encode usernames and passwords containing special characters. Never put real connection URLs in source control, browser configuration, build arguments, screenshots, or public logs. PostgreSQL may retain unrelated URL parameters; MySQL, MariaDB, and Redis URL query options are rejected to avoid silently ignoring connection/TLS settings.

| Additional variable | Default / purpose |
| --- | --- |
| `DB_TLS` | Unset. `true` enables verified TLS for SQL. For Redis, the URL scheme selects TLS; an explicit flag must agree with it. `false` cannot override a URL that requests TLS. |
| `DB_CA_FILE` | Optional server-mounted CA certificate path. Requires TLS; never served to the browser. |
| `HOST` | `0.0.0.0` in the Dockerfile. |
| `PORT` | `3000` in the Dockerfile and Compose examples. |
| `NODE_ENV` | `production` in the runtime image. |

### Verified TLS

- PostgreSQL supports URL `sslmode=require`, `verify-ca`, and `verify-full`; this checker enforces certificate and hostname verification for all three. `sslmode=disable` selects plaintext. URL `ssl=true/false` is also supported when consistent with other settings.
- PostgreSQL URL `sslrootcert`, or `DB_CA_FILE`, can supply a custom CA. Choose one CA source. Paired `sslcert` / `sslkey` and optional `sslpassword` support existing client-certificate configuration.
- MySQL and MariaDB use `DB_TLS=true`, with optional `DB_CA_FILE`. MySQL hostname verification is explicitly enabled.
- Redis uses `rediss://`, with optional `DB_CA_FILE` for custom trust.
- Conflicting settings, certificate files without TLS, `sslmode=no-verify`, opportunistic PostgreSQL TLS modes (`allow`/`prefer`), and `uselibpqcompat` are rejected. Certificate verification is never disabled. A missing/unreadable CA is a configuration error, without exposing its path.

Use plaintext only where your network policy permits it, such as the disposable local fixtures. See the official [MySQL2 TLS examples](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-connection), [MariaDB connection options](https://mariadb.com/docs/connectors/mariadb-connector-nodejs/node-js-connection-options), and [Redis client configuration](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md).

## API

`GET /api/database-status` returns HTTP 200 with `Cache-Control: no-store`, including unsuccessful checks:

```json
{
  "engine": "redis",
  "connected": true,
  "configured": true,
  "database": "0",
  "expectedVersion": null,
  "versionMajor": 8,
  "versionLabel": "8.2.11",
  "latencyMs": 4,
  "checkedAt": "2026-11-13T00:00:00.000Z",
  "message": "Redis is responding."
}
```

`engine` is `null` for an unsupported engine selection. `configured` is false for missing or invalid configuration; a valid URL with a connection failure has `configured: true` and `connected: false`. Failed probes return null database/version/latency fields. `expectedVersion` is retained for compatibility but is always null. Redis reports its logical database index as a string and may return null version fields when `INFO` is not permitted. Driver errors and credentials are never returned.

`GET /healthz` remains process liveness and returns HTTP 200 even when the database is unavailable. `GET /api/sample-data` returns the three generated datasets. Connectivity must not be used as the container's liveness condition.

### Probe permissions

- PostgreSQL: authenticate, connect to the selected database, and read `current_database()` / `current_setting('server_version')`.
- MySQL/MariaDB: authenticate, select the database, and run `SELECT DATABASE(), VERSION()`; no application tables or DDL permissions are needed.
- Redis: authenticate and run `PING`; allow `SELECT` for the configured logical database. `INFO server` is optional. A `NOPERM` response for metadata leaves connectivity green and explains that version information is unavailable. Automatic `CLIENT SETINFO` commands are disabled.

Use narrowly scoped probe credentials appropriate to your database policy. Server-supplied metadata is displayed as text; passwords, hosts, and connection URLs are not included in the status payload.

## Development and local examples

Use a current Node.js 22 release (also required by the retained Dockerfile) and pnpm **11.19.0**:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Nuxt development reads `.env`; a built server reads runtime environment variables and does not automatically load `.env`. `.env.example` is a template. Start a MySQL development preview in a POSIX shell:

```sh
DB_ENGINE=mysql DATABASE_URL='mysql://user:password@localhost:3306/database' corepack pnpm dev --host 127.0.0.1 --port 5175
```

PowerShell equivalent:

```powershell
$env:DB_ENGINE = 'mysql'
$env:DATABASE_URL = 'mysql://user:password@localhost:3306/database'
corepack pnpm dev --host 127.0.0.1 --port 5175
```

For MariaDB, set `DB_ENGINE=mariadb` with its MySQL-format URL. For Redis, set `DB_ENGINE=redis` and `REDIS_URL` instead. Missing configuration intentionally displays a red status without preventing page rendering.

The original PostgreSQL-only local example remains available with `docker compose up --build`, serving `http://127.0.0.1:3000`.

### Disposable fixtures for all four engines

`compose.test.yaml` starts four isolated databases and one Web Service on `http://127.0.0.1:13000`. Its fixed passwords are **test-only**, not deployment credentials. Database ports are not exposed to the host. Choose a fixture before startup:

| Engine | `DB_ENGINE` | `TEST_DATABASE_URL` |
| --- | --- | --- |
| PostgreSQL | `postgresql` | `postgresql://probe:fixture-postgres-password@postgresql:5432/probe` |
| MySQL | `mysql` | `mysql://probe:fixture-mysql-password@mysql:3306/probe` |
| MariaDB | `mariadb` | `mysql://probe:fixture-mariadb-password@mariadb:3306/probe` |
| Redis | `redis` | Unused; the fixture supplies `REDIS_URL` for logical database `2`. |

Example in a POSIX shell:

```sh
export DB_ENGINE=mysql
export TEST_DATABASE_URL='mysql://probe:fixture-mysql-password@mysql:3306/probe'
docker compose -f compose.test.yaml up --build -d --wait --wait-timeout 240
RUN_DB_INTEGRATION=true corepack pnpm test:integration
docker compose -f compose.test.yaml down -v --remove-orphans
```

In PowerShell, use `$env:DB_ENGINE`, `$env:TEST_DATABASE_URL`, and `$env:RUN_DB_INTEGRATION='true'`. Integration tests are skipped unless explicitly enabled. They create temporary Web containers on loopback port 13001, stop/restart only the named fixture services, and use a disposable Redis ACL user. Cleanup removes the disposable stack. Do not substitute live database URLs into integration fixtures.

## Deployment

Build using the root Dockerfile and start the image as a Web Service on port **3000**, with `/healthz` for liveness. The runtime starts `node .output/server/index.mjs` as the existing non-root user. Install all drivers at build time; select one engine and inject its credentials at runtime.

On NEO App, select repository branch `multi-db-check`, configure the runtime variables above, and bind the appropriate database URL. Use a reachable endpoint permitted by your project/network configuration. The public UI exposes operational connection metadata, so use suitable access controls for your deployment. This branch does not create, deploy, or modify cloud resources.

## Validation coverage and limits

The workflow runs on pushes to `multi-db-check` and supports manual invocation. It uses Ubuntu 24.04, Node.js 22, pnpm 11.19.0, frozen-lockfile installation, the production Nuxt build, and a Docker image build. Its matrix tests PostgreSQL 16 (`postgres:16-alpine`), MySQL `8.4.13`, MariaDB `11.4.13`, and Redis `8.2.11-alpine`.

Unit tests cover selection, backward compatibility, URL/TLS validation, sanitized failures, version parsing, deadlines, overlapping checks, cleanup, and optional Redis metadata. Live integration tests cover compiled HTTP/SSR output and all three tabs, valid and invalid credentials, missing configuration, engine mismatches, database-independent liveness, dependency loss/recovery, restart, and zero application-data writes. Redis metadata restrictions are tested against a real limited ACL user.

These fixtures use plaintext private-network connections. TLS configuration is unit-tested; successful TLS handshakes against real provider certificates are a separate deployment validation. CI validates rendered HTML and API behavior, not browser interaction or visual layout. Consult the branch's GitHub Actions results for actual run outcomes.
