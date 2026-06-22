#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pre-deployment environment check
#
# Run this script BEFORE executing migrations or seeders in any production-like
# environment. It validates that security-critical env vars are present and
# fails fast with a clear error if they are not.
#
# Usage:
#   bash scripts/pre-deploy-check.sh
#
# In CI/CD pipelines set APP_ENV=production in the environment and this script
# will enforce all production requirements.
#
# Database connectivity is accepted in any of the three forms the app supports:
#   1. DATABASE_URL  (single connection string — typical on Heroku/Replit/etc.)
#   2. PGHOST + PGDATABASE + PGUSER + PGPASSWORD  (Postgres-native vars)
#   3. DB_HOST + DB_DATABASE + DB_USERNAME + DB_PASSWORD  (Laravel .env style)
#
# Exit codes:
#   0  All checks passed — safe to proceed with migrations/seeds
#   1  One or more required checks failed — abort deployment
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_ENV="${APP_ENV:-local}"

echo "==> Pre-deployment check (APP_ENV=${APP_ENV})"

ERRORS=0

require_var() {
    local name="$1"
    local value="${!name:-}"
    if [ -z "$value" ]; then
        echo "  ✗ MISSING: ${name}" >&2
        ERRORS=$((ERRORS + 1))
    else
        echo "  ✓ ${name} is set"
    fi
}

warn_var() {
    local name="$1"
    local value="${!name:-}"
    if [ -z "$value" ]; then
        echo "  ⚠ WARNING: ${name} is not set (recommended for production)" >&2
    else
        echo "  ✓ ${name} is set"
    fi
}

# ── Database connectivity check ───────────────────────────────────────────────
# Accepts any of the three DB config styles the application supports.
check_database_config() {
    local DATABASE_URL="${DATABASE_URL:-}"
    local PGHOST="${PGHOST:-}"
    local PGDATABASE="${PGDATABASE:-}"
    local PGUSER="${PGUSER:-}"
    local PGPASSWORD="${PGPASSWORD:-}"
    local DB_HOST="${DB_HOST:-}"
    local DB_DATABASE="${DB_DATABASE:-}"
    local DB_USERNAME="${DB_USERNAME:-}"
    local DB_PASSWORD="${DB_PASSWORD:-}"

    if [ -n "$DATABASE_URL" ]; then
        echo "  ✓ DATABASE_URL is set (connection string style)"
        return 0
    fi

    if [ -n "$PGHOST" ] && [ -n "$PGDATABASE" ] && [ -n "$PGUSER" ]; then
        echo "  ✓ PG* vars are set (PGHOST=${PGHOST}, PGDATABASE=${PGDATABASE}, PGUSER=${PGUSER})"
        return 0
    fi

    if [ -n "$DB_HOST" ] && [ -n "$DB_DATABASE" ] && [ -n "$DB_USERNAME" ]; then
        echo "  ✓ DB_* vars are set (DB_HOST=${DB_HOST}, DB_DATABASE=${DB_DATABASE})"
        return 0
    fi

    echo "  ✗ MISSING: database configuration — set one of:" >&2
    echo "      DATABASE_URL  (single connection string)" >&2
    echo "      PGHOST + PGDATABASE + PGUSER + PGPASSWORD  (Postgres-native)" >&2
    echo "      DB_HOST + DB_DATABASE + DB_USERNAME + DB_PASSWORD  (Laravel style)" >&2
    ERRORS=$((ERRORS + 1))
}

if [ "$APP_ENV" = "production" ]; then
    echo ""
    echo "--- Required for production ---"

    # Core application key (used for encryption)
    require_var "APP_KEY"

    # Platform admin — seeder will also refuse to run without this
    require_var "PLATFORM_ADMIN_PASSWORD"

    # Database — any supported config style is acceptable
    check_database_config

    echo ""
    echo "--- Recommended for production ---"

    warn_var "STRIPE_KEY"
    warn_var "STRIPE_SECRET"
    warn_var "STRIPE_WEBHOOK_SECRET"
    warn_var "MAIL_HOST"
    warn_var "MAIL_USERNAME"
    warn_var "PLATFORM_ADMIN_EMAIL"

else
    echo "  (Skipping production-only checks for APP_ENV=${APP_ENV})"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
    echo "==> FAILED: ${ERRORS} required check(s) failed." >&2
    echo "    Fix the above errors before running migrations or seeders." >&2
    exit 1
fi

echo "==> All checks passed — safe to proceed."
exit 0
