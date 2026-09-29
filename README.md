# TEST FE WITH DB — Static Site

Static Nuxt front end prepared for NEO App with three randomized sample-data tables. This branch does not use a server runtime, API endpoint, environment variable, or database.

## What it doesp

- Hero title: `TEST FE WITH DB`.
- Green `Ready` state that identifies this build as a static site.
- Three accessible secondary tabs: Service inventory, Database workloads and Deployment events.
- Eight sample rows per table are generated directly in the browser.
- The `Regenerate data` button creates a fresh sample without a network request.
- No PostgreSQL connection or server-side endpoint exists in this branch.

## Local development

```sh
pnpm install --frozen-lockfile
pnpm tokens:build
pnpm dev --host 127.0.0.1 --port 5175
```

Open `http://127.0.0.1:5175`.

## Verification

```sh
pnpm check
pnpm build
pnpm preview
```

The production-ready static files are generated in `.output/public`. The preview command serves that directory on `http://127.0.0.1:4173` by default.

## NEO App configuration

1. Select **Static Site** in the NEO App project.
2. Use repository `https://github.com/zakihasny/deployment-neo-app`.
3. Select branch `static`.
4. Railpack can run the package build script, which executes `nuxt generate`.
5. The publish directory is `.output/public` when the dashboard requests one.
6. Do not configure `DATABASE_URL`; this branch has no database dependency.

The `main` branch remains the Web Service and PostgreSQL version. No NEO App resource is created or deployed by this branch.
