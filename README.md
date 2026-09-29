# TEST FE WITH DB

Nuxt Web Service prepared for NEO App with a read-only PostgreSQL 16 connectivity indicator and three randomized sample-data tables.

## What it doesp

- Hero title: `TEST FE WITH DB`.
- Green `Connected` state when `DATABASE_URL` answers a PostgreSQL query.
- Red `Not connected` state when configuration or connectivity fails.
- Three accessible secondary tabs: Service inventory, Database workloads and Deployment events.
- Generated sample rows are returned by the Web Service and are not stored in PostgreSQL.
- `GET /healthz` remains independent from database readiness.

## Local development

```sh
pnpm install --frozen-lockfile
pnpm tokens:build
pnpm dev --host 127.0.0.1 --port 5175
```

Without `DATABASE_URL`, the page intentionally shows a red database status. For a local PostgreSQL 16 test:

```sh
docker compose up --build
```

Open `http://127.0.0.1:3000`.

## Verification

```sh
pnpm check
pnpm build
```

## NEO App configuration

The NEO App dashboard and MCP were inspected without creating or deploying resources. The applicable configuration is:

1. Create NEO DB in the same project/environment.
2. Select PostgreSQL 16. For this test, Single instance and 10 GB are sufficient; automated backups are recommended.
3. Keep Public secure endpoint disabled when Web and DB communicate inside the same project network.
4. Create a Web service using **Build file** with this repository and `Dockerfile` at the project root. Local source ZIP is also supported by the dashboard.
5. Configure container port `3000` and health path `/healthz`.
6. Bind the database connection URL to the Web Service as `DATABASE_URL`. Do not place the real URL in Git or image build arguments.
7. Deploy the Web Service only after the NEO DB resource is ready.
8. Verify `/healthz`, then open the page and confirm the indicator shows `Connected` and PostgreSQL 16.

The source is prepared locally only. No NEO App service or database has been created or deployed by this project generation task.
