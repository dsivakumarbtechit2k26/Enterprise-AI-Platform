<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTenantsTable extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->create('tenants', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active'); // active, suspended, trial, expired
            $table->string('plan')->default('free');
            $table->string('stripe_id')->nullable()->index();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('subscription_ends_at')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->json('data')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('tenants');
    }
}
