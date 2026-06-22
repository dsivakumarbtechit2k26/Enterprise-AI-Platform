<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PlatformSeeder::class,
            PlatformSettingsSeeder::class,
            RbacSeeder::class,
            PlatformAdminSeeder::class,
            SuperAdminSeeder::class,
            SubscriptionPlanSeeder::class,
        ]);
    }
}
