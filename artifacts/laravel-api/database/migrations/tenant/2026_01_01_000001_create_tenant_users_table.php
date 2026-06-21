<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_users', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('central_user_id'); // references central.users.id
            $table->string('name');
            $table->string('email');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('central_user_id');
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_users');
    }
};
