<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('avatar')->nullable();
            $table->rememberToken();
            // Auth tracking
            $table->timestamp('last_login_at')->nullable();
            $table->unsignedSmallInteger('failed_login_count')->default(0);
            $table->timestamp('locked_until')->nullable();
            // MFA
            $table->boolean('mfa_enabled')->default(false);
            $table->text('mfa_secret')->nullable();
            $table->text('mfa_backup_codes')->nullable();
            // Tenant context
            $table->string('current_tenant_id')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::connection('central')->create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('sessions');
        Schema::connection('central')->dropIfExists('password_reset_tokens');
        Schema::connection('central')->dropIfExists('users');
    }
};
