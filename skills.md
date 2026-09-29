# Test Deployment NEO App project contract

## Scope

This branch is a standalone Nuxt Static Site for NEO App. It contains one hero, one accessible static-runtime status card, and exactly three secondary tabs with browser-generated sample tables. It must not call a server endpoint or database.

## Runtime contract

- Node.js 22+, Nuxt 4, SPA rendering and Nitro static preset.
- `pnpm build` must generate deployable files in `.output/public`.
- Generate all sample data inside the browser without network requests.
- Do not add `server/`, `DATABASE_URL`, PostgreSQL drivers, Docker, cron, queues or other runtime infrastructure to this branch.
- Keep `main` as the Web Service/PostgreSQL variant; static-only changes belong on branch `static`.

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
