<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connection = config('activitylog.database_connection');
        $table      = config('activitylog.table_name');

        Schema::connection($connection)->table($table, function (Blueprint $table) {
            $table->json('attribute_changes')->nullable()->after('properties');
        });
    }

    public function down(): void
    {
        $connection = config('activitylog.database_connection');
        $table      = config('activitylog.table_name');

        Schema::connection($connection)->table($table, function (Blueprint $table) {
            $table->dropColumn('attribute_changes');
        });
    }
};
