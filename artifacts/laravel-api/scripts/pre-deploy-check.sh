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
# Exit codes:
#   0  All checks passed — safe to proceed with migrations/seeds
#   1  One or more required vars are missing — abort deployment
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

if [ "$APP_ENV" = "production" ]; then
    echo ""
    echo "--- Required for production ---"

    # Core application
    require_var "APP_KEY"

    # Platform admin (the seeder will also refuse to run without this)
    require_var "PLATFORM_ADMIN_PASSWORD"

    # Database
    require_var "DB_HOST"
    require_var "DB_DATABASE"
    require_var "DB_USERNAME"
    require_var "DB_PASSWORD"

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
    echo "==> FAILED: ${ERRORS} required environment variable(s) missing." >&2
    echo "    Fix the above errors before running migrations or seeders." >&2
    exit 1
fi

echo "==> All checks passed — safe to proceed."
exit 0
