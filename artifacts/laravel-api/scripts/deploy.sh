#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Production deployment script
#
# Run this script to perform a full production deployment. It enforces the
# correct sequence: validate environment → migrate → seed → (optionally) start.
#
# Usage:
#   bash scripts/deploy.sh            # validate + migrate + seed
#   bash scripts/deploy.sh --no-seed  # skip seeding (subsequent deploys)
#
# The APP_ENV environment variable must be set to 'production' for this script
# to apply production-only guards. Any other value runs with minimal checks.
#
# Example (CI/CD):
#   APP_ENV=production \
#   PLATFORM_ADMIN_PASSWORD="$(vault kv get -field=password secret/platform-admin)" \
#   bash scripts/deploy.sh --no-seed
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SEED=true

for arg in "$@"; do
    case "$arg" in
        --no-seed) SEED=false ;;
        *) echo "Unknown argument: $arg" >&2; exit 1 ;;
    esac
done

cd "$APP_DIR"

echo "==> Step 1/4: Pre-deployment environment check"
bash "$SCRIPT_DIR/pre-deploy-check.sh"

echo ""
echo "==> Step 2/4: Clear compiled config"
php artisan config:clear --quiet

echo ""
echo "==> Step 3/4: Run database migrations"
php artisan migrate --force

if [ "$SEED" = true ]; then
    echo ""
    echo "==> Step 4/4: Seed platform admin"
    # pre-deploy-check.sh already validated PLATFORM_ADMIN_PASSWORD is set
    # in production — this will succeed or throw a clear RuntimeException.
    php artisan db:seed --class=PlatformAdminSeeder --force
else
    echo ""
    echo "==> Step 4/4: Seeding skipped (--no-seed)"
fi

echo ""
echo "==> Deployment completed successfully."
