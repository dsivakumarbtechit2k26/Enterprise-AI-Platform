<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->create('dynamic_module_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('dynamic_modules')->cascadeOnDelete();
            $table->string('tenant_id');
            $table->jsonb('data')->default('{}');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['module_id', 'tenant_id']);
            $table->index('tenant_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('dynamic_module_records');
    }
};
