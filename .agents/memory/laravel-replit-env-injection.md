---
name: Laravel Replit env injection
description: Replit workflow processes do not inherit shell-level environment variables (DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT). These must be injected into .env at startup.
---

## The Rule
Use a `start.sh` wrapper script as the workflow command. The script injects the PG* / DATABASE_URL env vars into `.env` before running `php artisan serve`.

**Why:** Replit secrets/env vars are available in bash (via the terminal / bash tool) but NOT in workflow subprocess environments. Laravel reads connection credentials from `.env` via `env()`. Without injection, `env('PGHOST')` returns null → falls back to `127.0.0.1` → connection refused.

**How to apply:** `artifacts/laravel-api/start.sh` — uses `sed -i` to `updateOrInsert` each env var into `.env`, then clears config cache, then execs `php artisan serve`. Workflow command: `bash artifacts/laravel-api/start.sh`.

The inject logic:
```bash
inject_env_var() {
    if grep -q "^${key}=" .env; then sed -i "s|^${key}=.*|${key}=${value}|" .env
    else echo "${key}=${value}" >> .env; fi
}
inject_env_var "DATABASE_URL" "$DATABASE_URL"
inject_env_var "PGHOST" "$PGHOST"
# ... etc
php artisan config:clear --quiet
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
```
