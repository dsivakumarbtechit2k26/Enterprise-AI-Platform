<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // free, trial, professional_monthly, etc.
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('price_cents')->default(0);
            $table->string('interval')->nullable(); // month, year, null
            $table->string('stripe_price_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('central')->create('plan_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_plan_id')->constrained('subscription_plans')->onDelete('cascade');
            $table->string('feature_key'); // max_users, max_storage_gb, ai_features, etc.
            $table->string('feature_value'); // numeric limit or bool flag
            $table->string('feature_type')->default('limit'); // limit, boolean, list
            $table->timestamps();

            $table->unique(['subscription_plan_id', 'feature_key']);
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('plan_features');
        Schema::connection('central')->dropIfExists('subscription_plans');
    }
};
