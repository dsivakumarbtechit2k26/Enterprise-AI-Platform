<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    /**
     * Field types:
     *   text, long_text, number, decimal, currency,
     *   date, datetime, boolean, single_select, multi_select,
     *   user_picker, relation
     */
    public function up(): void
    {
        Schema::connection('central')->create('dynamic_module_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('dynamic_modules')->cascadeOnDelete();
            $table->string('name');           // machine-readable slug, e.g. "first_name"
            $table->string('label');          // human label, e.g. "First Name"
            $table->string('field_type');     // see type list above
            $table->json('options')->nullable(); // select choices, relation target, number min/max
            $table->boolean('is_required')->default(false);
            $table->boolean('show_in_list')->default(true);
            $table->boolean('show_in_form')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('module_id');
            $table->unique(['module_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('dynamic_module_fields');
    }
};
