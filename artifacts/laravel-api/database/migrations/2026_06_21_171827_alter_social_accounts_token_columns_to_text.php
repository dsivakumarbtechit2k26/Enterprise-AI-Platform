<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->table('social_accounts', function (Blueprint $table) {
            $table->text('provider_token')->nullable()->change();
            $table->text('provider_refresh_token')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::connection('central')->table('social_accounts', function (Blueprint $table) {
            $table->string('provider_token')->nullable()->change();
            $table->string('provider_refresh_token')->nullable()->change();
        });
    }
};
