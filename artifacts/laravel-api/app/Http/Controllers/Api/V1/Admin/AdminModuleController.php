<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\DynamicModule;
use App\Models\DynamicModuleField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;

class AdminModuleController extends Controller
{
    // ── Module CRUD ────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = DynamicModule::withCount('records');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ILIKE', "%{$search}%")
                  ->orWhere('slug', 'ILIKE', "%{$search}%");
            });
        }

        if ($request->has('is_enabled')) {
            $query->where('is_enabled', filter_var($request->input('is_enabled'), FILTER_VALIDATE_BOOLEAN));
        }

        $query->withCount(['records', 'fields']);
        $modules = $query->orderBy('name')->get()->map(fn ($m) => $this->formatModule($m, false));

        return response()->json(['data' => $modules]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:100'],
            'slug'        => ['nullable', 'string', 'max:60', 'alpha_dash', 'unique:central.dynamic_modules,slug'],
            'icon'        => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_enabled'  => ['boolean'],
            'settings'    => ['nullable', 'array'],
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $module = DB::connection('central')->transaction(function () use ($validated) {
            $module = DynamicModule::create($validated);
            $this->ensureModulePermissions($module->slug);
            return $module;
        });

        $module->loadCount('records');

        return response()->json(['data' => $this->formatModule($module, true)], 201);
    }

    public function show(int $id): JsonResponse
    {
        $module = DynamicModule::withCount('records')->findOrFail($id);
        $module->load('fields');

        return response()->json(['data' => $this->formatModule($module, true)]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $module = DynamicModule::findOrFail($id);

        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:100'],
            'icon'        => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_enabled'  => ['boolean'],
            'settings'    => ['nullable', 'array'],
        ]);

        $module->update($validated);
        $module->loadCount('records');
        $module->load('fields');

        return response()->json(['data' => $this->formatModule($module, true)]);
    }

    public function destroy(int $id): JsonResponse
    {
        $module = DynamicModule::findOrFail($id);

        DB::connection('central')->transaction(function () use ($module) {
            // Remove auto-created permissions — use where()->first() to avoid
            // Spatie throwing PermissionDoesNotExist when permission is missing.
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                Permission::where('name', "{$module->slug}.{$action}")
                    ->where('guard_name', 'web')
                    ->first()
                    ?->delete();
            }
            $module->delete();
        });

        return response()->json(['message' => 'Module deleted.']);
    }

    public function toggle(int $id): JsonResponse
    {
        $module = DynamicModule::findOrFail($id);
        $module->update(['is_enabled' => ! $module->is_enabled]);

        return response()->json([
            'data' => ['id' => $module->id, 'is_enabled' => $module->is_enabled],
        ]);
    }

    // ── Field CRUD ─────────────────────────────────────────────────────────────

    public function storeField(Request $request, int $moduleId): JsonResponse
    {
        $module = DynamicModule::findOrFail($moduleId);

        $validated = $request->validate([
            'name'         => ['required', 'string', 'max:80', 'alpha_dash', "unique:central.dynamic_module_fields,name,NULL,id,module_id,{$moduleId}"],
            'label'        => ['required', 'string', 'max:100'],
            'field_type'   => ['required', 'string', 'in:text,long_text,number,decimal,currency,date,datetime,boolean,single_select,multi_select,user_picker,relation'],
            'options'      => ['nullable', 'array'],
            'is_required'  => ['boolean'],
            'show_in_list' => ['boolean'],
            'show_in_form' => ['boolean'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
        ]);

        $validated['module_id']  = $moduleId;
        $validated['sort_order'] ??= DynamicModuleField::where('module_id', $moduleId)->max('sort_order') + 1;

        $field = DynamicModuleField::create($validated);

        return response()->json(['data' => $this->formatField($field)], 201);
    }

    public function updateField(Request $request, int $moduleId, int $fieldId): JsonResponse
    {
        $field = DynamicModuleField::where('module_id', $moduleId)->findOrFail($fieldId);

        $validated = $request->validate([
            'label'        => ['sometimes', 'string', 'max:100'],
            'field_type'   => ['sometimes', 'string', 'in:text,long_text,number,decimal,currency,date,datetime,boolean,single_select,multi_select,user_picker,relation'],
            'options'      => ['nullable', 'array'],
            'is_required'  => ['boolean'],
            'show_in_list' => ['boolean'],
            'show_in_form' => ['boolean'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
        ]);

        $field->update($validated);

        return response()->json(['data' => $this->formatField($field->fresh())]);
    }

    public function destroyField(int $moduleId, int $fieldId): JsonResponse
    {
        DynamicModuleField::where('module_id', $moduleId)->findOrFail($fieldId)->delete();

        return response()->json(['message' => 'Field deleted.']);
    }

    public function reorderFields(Request $request, int $moduleId): JsonResponse
    {
        DynamicModule::findOrFail($moduleId);

        $validated = $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        DB::connection('central')->transaction(function () use ($moduleId, $validated) {
            foreach ($validated['ids'] as $order => $fieldId) {
                DynamicModuleField::where('module_id', $moduleId)
                    ->where('id', $fieldId)
                    ->update(['sort_order' => $order]);
            }
        });

        return response()->json(['message' => 'Fields reordered.']);
    }

    // ── Formatters ─────────────────────────────────────────────────────────────

    private function formatModule(DynamicModule $module, bool $includeFields): array
    {
        $out = [
            'id'            => $module->id,
            'slug'          => $module->slug,
            'name'          => $module->name,
            'icon'          => $module->icon,
            'description'   => $module->description,
            'is_enabled'    => $module->is_enabled,
            'settings'      => $module->settings,
            'records_count' => $module->records_count ?? null,
            'fields_count'  => $module->fields_count ?? null,
            'created_at'    => $module->created_at,
            'updated_at'    => $module->updated_at,
        ];

        if ($includeFields) {
            $out['fields'] = ($module->relationLoaded('fields') ? $module->fields : $module->fields()->get())
                ->map(fn ($f) => $this->formatField($f))
                ->values()
                ->all();
        }

        return $out;
    }

    private function formatField(DynamicModuleField $field): array
    {
        return [
            'id'           => $field->id,
            'module_id'    => $field->module_id,
            'name'         => $field->name,
            'label'        => $field->label,
            'field_type'   => $field->field_type,
            'options'      => $field->options,
            'is_required'  => $field->is_required,
            'show_in_list' => $field->show_in_list,
            'show_in_form' => $field->show_in_form,
            'sort_order'   => $field->sort_order,
            'created_at'   => $field->created_at,
        ];
    }

    // ── Permissions auto-provisioning ─────────────────────────────────────────

    private function ensureModulePermissions(string $slug): void
    {
        foreach (['view', 'create', 'edit', 'delete'] as $action) {
            Permission::firstOrCreate(
                ['name' => "{$slug}.{$action}", 'guard_name' => 'web'],
            );
        }
    }
}
