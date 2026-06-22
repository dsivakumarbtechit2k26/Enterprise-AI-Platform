<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

/**
 * Creates (or updates) the platform-admin super-user.
 *
 * Credentials are driven by env vars so they can be changed without
 * touching code:
 *
 *   PLATFORM_ADMIN_EMAIL    (default: admin@platform.local)
 *   PLATFORM_ADMIN_PASSWORD (default: ChangeMe123!)
 *   PLATFORM_ADMIN_NAME     (default: Platform Admin)
 *
 * Run standalone:
 *   php artisan db:seed --class=PlatformAdminSeeder
 *
 * The RbacSeeder must have been run first so the 'platform-admin' role
 * (team_id = 'central') already exists.
 */
class PlatformAdminSeeder extends Seeder
{
    public const CENTRAL_TEAM = 'central';

    public function run(): void
    {
        $email    = env('PLATFORM_ADMIN_EMAIL',    'admin@platform.local');
        $password = env('PLATFORM_ADMIN_PASSWORD', 'ChangeMe123!');
        $name     = env('PLATFORM_ADMIN_NAME',     'Platform Admin');

        // Set Spatie team context to central so role assignment lands correctly.
        app(PermissionRegistrar::class)->setPermissionsTeamId(self::CENTRAL_TEAM);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::on('central')->updateOrCreate(
            ['email' => $email],
            [
                'name'              => $name,
                'password'          => Hash::make($password),
                'email_verified_at' => now(),
            ]
        );

        // Assign platform-admin role in the central team scope.
        $user->setRelation('roles', collect()); // clear cached relations
        $user->syncRoles(['platform-admin']);

        $this->command->info("✓ Platform admin ready — email: {$email}");
        $this->command->warn('  Change the password via PLATFORM_ADMIN_PASSWORD before going to production.');
    }
}
