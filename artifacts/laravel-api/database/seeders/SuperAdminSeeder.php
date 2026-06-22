<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

/**
 * Creates (or updates) the super-admin account.
 *
 * The super-admin role carries ALL permissions and is the highest-privilege
 * account on the platform — used by the platform owner to manage everything
 * including the dynamic module builder.
 *
 * Credentials:
 *   Email:    superadmin@platform.local
 *   Password: SuperAdmin123!  (dev only — override via SUPER_ADMIN_PASSWORD)
 *
 * Run standalone:
 *   php artisan db:seed --class=SuperAdminSeeder
 *
 * RbacSeeder must run first so the 'super-admin' role already exists.
 */
class SuperAdminSeeder extends Seeder
{
    public const CENTRAL_TEAM = 'central';
    private const DEV_FALLBACK_PASSWORD = 'SuperAdmin123!';

    public function run(): void
    {
        $isProduction = app()->environment('production');
        $rawPassword  = env('SUPER_ADMIN_PASSWORD');

        if ($isProduction && empty($rawPassword)) {
            throw new \RuntimeException(
                'SUPER_ADMIN_PASSWORD must be set in production. ' .
                'Refusing to seed the super-admin account with a default password.'
            );
        }

        if (empty($rawPassword)) {
            $rawPassword = self::DEV_FALLBACK_PASSWORD;
            $this->command->warn(
                '  SUPER_ADMIN_PASSWORD is not set — using dev fallback. ' .
                'Set the env var before deploying to production.'
            );
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId(self::CENTRAL_TEAM);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::on('central')->updateOrCreate(
            ['email' => 'superadmin@platform.local'],
            [
                'name'              => 'Super Admin',
                'password'          => Hash::make($rawPassword),
                'email_verified_at' => now(),
            ]
        );

        $user->setRelation('roles', collect());
        $user->syncRoles(['super-admin']);

        $this->command->info('✓ Super admin ready — email: superadmin@platform.local');

        if (! $isProduction) {
            $this->command->warn('  Default password: SuperAdmin123! — set SUPER_ADMIN_PASSWORD before going to production.');
        }
    }
}
