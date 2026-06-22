# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Platform Admin Credentials

The platform-admin user (used to access `/admin`) is seeded by `PlatformAdminSeeder`.
Credentials are controlled by env vars — set them before going to production:

| Env var                  | Default                  | Purpose              |
|--------------------------|--------------------------|----------------------|
| `PLATFORM_ADMIN_EMAIL`   | `admin@platform.local`   | Admin login email    |
| `PLATFORM_ADMIN_PASSWORD`| `ChangeMe123!`           | Admin login password |
| `PLATFORM_ADMIN_NAME`    | `Platform Admin`         | Admin display name   |

To create or reset the admin user:
```bash
# Must run RbacSeeder first if it hasn't been run
php artisan db:seed --class=RbacSeeder
php artisan db:seed --class=PlatformAdminSeeder
```

The seeder is idempotent — safe to re-run. It uses `updateOrCreate` so it won't
duplicate the user, but it will reset the password to the env-var value.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
