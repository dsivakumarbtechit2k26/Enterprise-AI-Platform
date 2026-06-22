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

class DynamicRecordController extends Controller
{
    /**
     * Resolve module by slug and guard that it is enabled.
     */
    private function resolveModule(string $slug): DynamicModule
    {
        return DynamicModule::with('fields')->where('slug', $slug)->where('is_enabled', true)->firstOrFail();
    }

    /**
     * GET /api/v1/m/{slug}/records
     */
    public function index(Request $request, string $slug): JsonResponse
    {
        $module    = $this->resolveModule($slug);
        $tenantId  = $this->tenantId();

        $query = DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId);

        // ── Search across all text-like fields ──────────────────────────────
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw("data::text ILIKE ?", ["%{$search}%"]);
            });
        }

        // ── Sort ─────────────────────────────────────────────────────────────
        $sortField = $request->input('sort_field');
        $sortDir   = $request->input('sort_dir', 'desc') === 'asc' ? 'asc' : 'desc';

        if ($sortField && $sortField !== 'created_at') {
            $query->orderByRaw("data->>'??' {$sortDir}", [$sortField]);
        } else {
            $query->orderBy('created_at', $sortDir);
        }

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

    /**
     * GET /api/v1/m/{slug}/stats
     */
    public function stats(string $slug): JsonResponse
    {
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
                'total'      => $total,
                'this_week'  => $thisWeek,
                'daily_chart'=> $chart,
            ],
        ]);
    }

    /**
     * POST /api/v1/m/{slug}/records
     */
    public function store(Request $request, string $slug): JsonResponse
    {
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

    /**
     * GET /api/v1/m/{slug}/records/{id}
     */
    public function show(string $slug, int $id): JsonResponse
    {
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

    /**
     * PUT /api/v1/m/{slug}/records/{id}
     */
    public function update(Request $request, string $slug, int $id): JsonResponse
    {
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

    /**
     * DELETE /api/v1/m/{slug}/records/{id}
     */
    public function destroy(string $slug, int $id): JsonResponse
    {
        $module   = $this->resolveModule($slug);
        $tenantId = $this->tenantId();

        DynamicModuleRecord::where('module_id', $module->id)
            ->where('tenant_id', $tenantId)
            ->findOrFail($id)
            ->delete();

        return response()->json(['message' => 'Record deleted.']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function tenantId(): string
    {
        // active_tenant_id is set by ResolveTenantPermissions middleware
        return request()->attributes->get('active_tenant_id', '');
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
