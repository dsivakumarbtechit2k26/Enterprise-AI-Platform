<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->create('field_permissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->string('model_class');
            $table->string('field_name');
            $table->boolean('can_read')->default(true);
            $table->boolean('can_write')->default(false);
            // 'central' = platform scope; tenant slug = tenant scope
            $table->string('team_id')->default('central');
            $table->timestamps();

            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->unique(['role_id', 'model_class', 'field_name', 'team_id'], 'field_perms_unique');
            $table->index(['model_class', 'field_name']);
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('field_permissions');
    }
};
