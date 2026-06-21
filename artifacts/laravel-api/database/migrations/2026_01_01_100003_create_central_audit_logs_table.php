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
        Schema::connection('central')->create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event', 128);
            $table->string('auditable_type', 128)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->string('actor_type', 128)->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('tenant_id')->nullable();
            $table->timestamps();

            $table->index(['auditable_type', 'auditable_id']);
            $table->index(['actor_type', 'actor_id']);
            $table->index('tenant_id');
            $table->index('event');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('audit_logs');
    }
};
