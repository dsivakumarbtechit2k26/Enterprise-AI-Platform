<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        // Pivot table: central users ↔ tenants they belong to
        Schema::connection('central')->create('user_tenants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->string('role')->default('member'); // owner, admin, manager, member
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('user_tenants');
    }
};
