#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Inject Replit-provided PostgreSQL credentials into .env at startup.
# These vars are available in the Replit shell environment but are not
# written to .env (they are secrets).  We append/update them here so
# that `php artisan serve` (which reads .env) can reach the database.
inject_env_var() {
    local key="$1"
    local value="$2"
    if [ -n "$value" ]; then
        if grep -q "^${key}=" .env 2>/dev/null; then
            sed -i "s|^${key}=.*|${key}=${value}|" .env
        else
            echo "${key}=${value}" >> .env
        fi
    fi
}

inject_env_var "DATABASE_URL"  "$DATABASE_URL"
inject_env_var "PGHOST"        "$PGHOST"
inject_env_var "PGPORT"        "$PGPORT"
inject_env_var "PGDATABASE"    "$PGDATABASE"
inject_env_var "PGUSER"        "$PGUSER"
inject_env_var "PGPASSWORD"    "$PGPASSWORD"

# Clear compiled config so new .env values are picked up
php artisan config:clear --quiet

# ── Production safety check ───────────────────────────────────────────────────
# When running in production, validate that all required environment variables
# are present before the server starts. This catches misconfigured deployments
# early (on boot) rather than at the moment a user tries to log in.
if [ "${APP_ENV:-local}" = "production" ]; then
    echo "==> Running production environment checks..."
    bash "$(dirname "$0")/scripts/pre-deploy-check.sh"
fi

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
