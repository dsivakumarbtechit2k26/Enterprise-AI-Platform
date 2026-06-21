<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_registry', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // crm, hrm, inventory, accounting, etc.
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->json('settings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_registry');
    }
};
