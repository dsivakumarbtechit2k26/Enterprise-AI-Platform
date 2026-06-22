<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DynamicModule;
use App\Models\DynamicModuleRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DynamicRecordController extends Controller
{
    // ── Module resolver ───────────────────────────────────────────────────────

    private function resolveModule(string $slug): DynamicModule
    {
        return DynamicModule::with('fields')
            ->where('slug', $slug)
            ->where('is_enabled', true)
            ->firstOrFail();
    }

    // ── Per-module authorization ───────────────────────────────────────────────
    //
    // Each enabled module auto-provisions {slug}.view/.create/.edit/.delete
    // permissions (AdminModuleController::ensureModulePermissions).
    //
    // Bypass rules (ordered):
    //   1. Unauthenticated → 401
    //   2. Central / platform scope (no real tenant) → always allow
    //   3. User has super-admin or platform-admin role → always allow
    //   4. Standard Spatie permission check via hasPermissionTo()

    private function authorizeAction(string $slug, string $action): void
    {
        $user = Auth::user();

        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        $tenantId = $this->tenantId();

        // Platform-admin or central scope — no tenant subscription check needed
        if (empty($tenantId) || $tenantId === 'central') {
            return;
        }

        // Roles that bypass module-level ACL
        if ($user->hasRole(['super-admin', 'platform-admin'])) {
            return;
        }

        // Standard Spatie permission check (tenant-scoped permissions loaded
        // by ResolveTenantPermissions middleware before this controller runs).
        // Wrap in try/catch: Spatie throws PermissionDoesNotExist if the permission
        // was never provisioned (e.g. stale tenant or manually-deleted permission).
        // Both cases should be treated as 403, not a 500.
        try {
            if (! $user->hasPermissionTo("{$slug}.{$action}")) {
                abort(403, "You don't have '{$slug}.{$action}' permission for this module.");
            }
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist) {
            abort(403, "Module '{$slug}' does not have '{$action}' permission configured.");
        }
    }

    // ── Shared filter + sort application ──────────────────────────────────────

    private function applyFiltersAndSort(
        Request $request,
        \Illuminate\Database\Eloquent\Builder $query,
        DynamicModule $module,
    ): void {
        // Full-text search across all JSONB data
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw("data::text ILIKE ?", ["%{$search}%"]);
            });
        }

        // Field-specific filters: ?filters[field_name]=value
        // Only applied for fields that actually belong to this module.
        if ($rawFilters = $request->input('filters')) {
            foreach ((array) $rawFilters as $fieldName => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $cleanField = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $fieldName);
                if (! $module->fields->firstWhere('name', $cleanField)) {
                    continue;
                }
                $query->whereRaw(
                    "lower(data->>'{$cleanField}') LIKE ?",
                    ['%' . mb_strtolower((string) $value) . '%'],
                );
            }
        }

        // Sort — default: created_at DESC
        $sortField = $request->input('sort_field');
        $sortDir   = $request->input('sort_dir', 'desc') === 'asc' ? 'asc' : 'desc';

        if ($sortField && $sortField !== 'created_at') {
            // Validate against module fields; names are alpha_dash (enforced at creation)
            $validField = $module->fields->firstWhere('name', $sortField);
            if ($validField) {
                $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', $sortField);
                $query->orderByRaw("(data->>'{$clean}') {$sortDir} NULLS LAST");
            } else {
                $query->orderBy('created_at', $sortDir);
            }
        } else {
            $query->orderBy('created_at', $sortDir);
        }
    }

    // ── GET /api/v1/m/{slug}/stats ─────────────────────────────────────────────

    public function stats(string $slug): JsonResponse
    {
        $this->authorizeAction($slug, 'view');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $baseQuery = fn () => DynamicModuleRecord::where('module_id', $module->id)
                                                  ->where('tenant_id', $tenantId);

        $total     = $baseQuery()->count();
        $thisWeek  = $baseQuery()->where('created_at', '>=', Carbon::now()->startOfWeek())->count();

        // Last 7 days grouped by date
        $daily = $baseQuery()
            ->selectRaw("DATE(created_at) AS day, COUNT(*) AS cnt")
            ->where('created_at', '>=', Carbon::now()->subDays(6)->startOfDay())
            ->groupByRaw("DATE(created_at)")
            ->orderByRaw("DATE(created_at)")
            ->get()
            ->mapWithKeys(fn ($r) => [$r->day => (int) $r->cnt]);

        $chart = [];
        for ($i = 6; $i >= 0; $i--) {
            $day     = Carbon::now()->subDays($i)->format('Y-m-d');
            $chart[] = ['date' => $day, 'count' => $daily->get($day, 0)];
        }

        return response()->json([
            'data' => [
                'total'       => $total,
                'this_week'   => $thisWeek,
                'daily_chart' => $chart,
            ],
        ]);
    }

    // ── GET /api/v1/m/{slug}/records ──────────────────────────────────────────

    public function index(Request $request, string $slug): JsonResponse
    {
        $this->authorizeAction($slug, 'view');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $query = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId);

        $this->applyFiltersAndSort($request, $query, $module);

        $perPage   = min((int) $request->input('per_page', 20), 100);
        $paginator = $query->paginate($perPage);

        $items = collect($paginator->items())->map(fn ($r) => $this->formatRecord($r));

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
            'module' => $this->formatModuleMeta($module),
        ]);
    }

    // ── GET /api/v1/m/{slug}/records/export (CSV) ─────────────────────────────
    // Streams a CSV with the same search/filter/sort params as the list.
    // Capped at 10 000 rows to prevent memory exhaustion.

    public function export(Request $request, string $slug): StreamedResponse
    {
        $this->authorizeAction($slug, 'view');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $query = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId);

        $this->applyFiltersAndSort($request, $query, $module);

        $records    = $query->limit(10_000)->get();
        $allFields  = $module->fields->sortBy('sort_order');
        $filename   = "{$slug}-records-" . now()->format('Y-m-d') . ".csv";

        return response()->streamDownload(function () use ($records, $allFields) {
            $out = fopen('php://output', 'w');
            fputcsv($out, array_merge(['ID'], $allFields->pluck('label')->toArray(), ['Created At']));
            foreach ($records as $record) {
                $row = [$record->id];
                foreach ($allFields as $field) {
                    $val = $record->data[$field->name] ?? '';
                    $row[] = is_array($val) ? implode(', ', $val) : (string) $val;
                }
                $row[] = $record->created_at->format('Y-m-d H:i:s');
                fputcsv($out, $row);
            }
            fclose($out);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ── POST /api/v1/m/{slug}/records ──────────────────────────────────────────

    public function store(Request $request, string $slug): JsonResponse
    {
        $this->authorizeAction($slug, 'create');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $data   = $request->input('data', []);
        $errors = $module->validateData($data);

        if (! empty($errors)) {
            return response()->json(['errors' => $errors], 422);
        }

        $record = DynamicModuleRecord::create([
            'module_id'  => $module->id,
            'tenant_id'  => $tenantId,
            'data'       => $data,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $this->formatRecord($record)], 201);
    }

    // ── GET /api/v1/m/{slug}/records/{id} ─────────────────────────────────────

    public function show(string $slug, int $id): JsonResponse
    {
        $this->authorizeAction($slug, 'view');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $record = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        return response()->json([
            'data'   => $this->formatRecord($record),
            'module' => $this->formatModuleMeta($module),
        ]);
    }

    // ── PUT /api/v1/m/{slug}/records/{id} ─────────────────────────────────────

    public function update(Request $request, string $slug, int $id): JsonResponse
    {
        $this->authorizeAction($slug, 'edit');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $record = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        $data   = $request->input('data', []);
        $errors = $module->validateData($data);

        if (! empty($errors)) {
            return response()->json(['errors' => $errors], 422);
        }

        $record->update(['data' => $data]);

        return response()->json(['data' => $this->formatRecord($record->fresh())]);
    }

    // ── DELETE /api/v1/m/{slug}/records/{id} ──────────────────────────────────

    public function destroy(string $slug, int $id): JsonResponse
    {
        $this->authorizeAction($slug, 'delete');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId)
            ->findOrFail($id)
            ->delete();

        return response()->json(['message' => 'Record deleted.']);
    }

    // ── DELETE /api/v1/m/{slug}/records  (bulk) ────────────────────────────────

    public function bulkDestroy(Request $request, string $slug): JsonResponse
    {
        $this->authorizeAction($slug, 'delete');
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer'],
        ]);

        $deleted = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $validated['ids'])
            ->delete();

        return response()->json(['deleted' => $deleted]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function tenantId(): string
    {
        return (string) (request()->attributes->get('active_tenant_id', ''));
    }

    private function formatRecord(DynamicModuleRecord $record): array
    {
        return [
            'id'         => $record->id,
            'module_id'  => $record->module_id,
            'tenant_id'  => $record->tenant_id,
            'data'       => $record->data,
            'created_by' => $record->created_by,
            'created_at' => $record->created_at,
            'updated_at' => $record->updated_at,
        ];
    }

    private function formatModuleMeta(DynamicModule $module): array
    {
        return [
            'id'     => $module->id,
            'slug'   => $module->slug,
            'name'   => $module->name,
            'icon'   => $module->icon,
            'fields' => $module->fields->map(fn ($f) => [
                'id'           => $f->id,
                'name'         => $f->name,
                'label'        => $f->label,
                'field_type'   => $f->field_type,
                'options'      => $f->options,
                'is_required'  => $f->is_required,
                'show_in_list' => $f->show_in_list,
                'show_in_form' => $f->show_in_form,
                'sort_order'   => $f->sort_order,
            ])->values(),
        ];
    }
}
