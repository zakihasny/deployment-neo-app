# Test Deployment NEO App project contract

## Scope

This project is a standalone Nuxt Web Service for validating a read-only connection to NEO DB PostgreSQL 16. It contains one hero, one accessible database status indicator, and exactly three secondary tabs with generated sample tables. Sample rows are never written to PostgreSQL.

## Runtime contract

- Node.js 22+, Nuxt 4 and Nitro node-server preset.
- Container listens on `0.0.0.0:3000`; NEO App Web Service must target port 3000.
- `GET /healthz` is process liveness and never depends on the database.
- `GET /api/database-status` performs a bounded read-only query using `DATABASE_URL` and never exposes connection errors or credentials.
- The real `DATABASE_URL` belongs in NEO App environment variables or managed-resource binding, never source control.
- NEO DB must use PostgreSQL 16. Keep its public endpoint disabled unless an explicitly reviewed external-access requirement exists.

## Design contract

Normative source: `https://ds.biznetgio.com/skills.md`, reviewed at version 1.3.25.

- Use Geist with Inter/system-ui fallback.
- Use semantic tokens generated from `design-tokens/bgn.tokens.json`; never edit `bgn.tokens.css` directly.
- Primary 700 is reserved for interaction and meaningful state. Database status always includes text, not color alone.
- Visible cards, tables, controls and shells use Neutral 300 borders.
- Secondary tabs keep typography and geometry stable in all states. Pressed state uses a square state layer.
- Tables remain horizontally scrollable on narrow screens.
- Maintain keyboard tab navigation, visible focus, sufficient contrast, and reduced-motion support.
- Record meaningful design changes in `changelog.md`.

## Verification

Run:

```sh
pnpm tokens:build
pnpm check
pnpm build
```

Do not claim a live NEO DB connection or deployment without testing the actual deployed environment.
