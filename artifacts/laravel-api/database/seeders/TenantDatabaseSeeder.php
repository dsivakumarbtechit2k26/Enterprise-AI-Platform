<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TenantDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Seed default modules for every new tenant
        $modules = [
            ['key' => 'crm',         'name' => 'CRM',              'is_enabled' => true],
            ['key' => 'hrm',         'name' => 'HR Management',    'is_enabled' => true],
            ['key' => 'inventory',   'name' => 'Inventory',        'is_enabled' => true],
            ['key' => 'accounting',  'name' => 'Accounting',       'is_enabled' => true],
            ['key' => 'tasks',       'name' => 'Tasks',            'is_enabled' => true],
            ['key' => 'projects',    'name' => 'Projects',         'is_enabled' => true],
            ['key' => 'pos',         'name' => 'Point of Sale',    'is_enabled' => false],
            ['key' => 'warehouse',   'name' => 'Warehouse',        'is_enabled' => false],
            ['key' => 'ecommerce',   'name' => 'E-Commerce',       'is_enabled' => false],
        ];

        foreach ($modules as $module) {
            DB::table('module_registry')->updateOrInsert(
                ['key' => $module['key']],
                array_merge($module, ['created_at' => now(), 'updated_at' => now()])
            );
        }
    }
}
