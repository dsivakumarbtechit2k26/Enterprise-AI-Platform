<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DynamicModule extends Model
{
    protected $connection = 'central';
    protected $table      = 'dynamic_modules';

    protected $fillable = [
        'slug',
        'name',
        'icon',
        'description',
        'is_enabled',
        'settings',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'settings'   => 'array',
    ];

    public function fields(): HasMany
    {
        return $this->hasMany(DynamicModuleField::class, 'module_id')->orderBy('sort_order');
    }

    public function records(): HasMany
    {
        return $this->hasMany(DynamicModuleRecord::class, 'module_id');
    }

    /**
     * Returns fields keyed by their machine name.
     * @return array<string, DynamicModuleField>
     */
    public function fieldsMap(): array
    {
        return $this->fields->keyBy('name')->all();
    }

    /**
     * Validate a record data payload against this module's field definitions.
     * Returns an array of validation errors (empty = valid).
     */
    public function validateData(array $data): array
    {
        $errors = [];
        $fieldTypes = ['text', 'long_text', 'number', 'decimal', 'currency',
                       'date', 'datetime', 'boolean', 'single_select',
                       'multi_select', 'user_picker', 'relation'];

        foreach ($this->fields as $field) {
            $value = $data[$field->name] ?? null;

            // Required check
            if ($field->is_required && ($value === null || $value === '' || $value === [])) {
                $errors[$field->name][] = "{$field->label} is required.";
                continue;
            }

            if ($value === null || $value === '') {
                continue;
            }

            // Type-specific validation
            match ($field->field_type) {
                'number'  => is_numeric($value) ?: ($errors[$field->name][] = "{$field->label} must be a number."),
                'decimal', 'currency' => is_numeric($value) ?: ($errors[$field->name][] = "{$field->label} must be a number."),
                'date'    => (bool) strtotime((string) $value) ?: ($errors[$field->name][] = "{$field->label} must be a valid date."),
                'datetime'=> (bool) strtotime((string) $value) ?: ($errors[$field->name][] = "{$field->label} must be a valid date/time."),
                'single_select' => $this->validateSingleSelect($field, $value, $errors),
                'multi_select'  => $this->validateMultiSelect($field, $value, $errors),
                default         => null,
            };
        }

        return $errors;
    }

    private function validateSingleSelect(DynamicModuleField $field, mixed $value, array &$errors): void
    {
        $choices = $field->options['choices'] ?? [];
        if (! empty($choices) && ! in_array($value, $choices, true)) {
            $errors[$field->name][] = "{$field->label} must be one of the allowed choices.";
        }
    }

    private function validateMultiSelect(DynamicModuleField $field, mixed $value, array &$errors): void
    {
        if (! is_array($value)) {
            $errors[$field->name][] = "{$field->label} must be an array of choices.";
            return;
        }
        $choices = $field->options['choices'] ?? [];
        if (! empty($choices)) {
            foreach ($value as $v) {
                if (! in_array($v, $choices, true)) {
                    $errors[$field->name][] = "{$field->label}: '{$v}' is not an allowed choice.";
                }
            }
        }
    }
}
