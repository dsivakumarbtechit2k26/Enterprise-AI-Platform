<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminAuditLogController extends Controller
{
    public function index(Request $request): JsonResponse|StreamedResponse
    {
        $query = AuditLog::query()->orderByDesc('created_at');

        if ($tenantId = $request->input('tenant_id')) {
            $query->where('tenant_id', $tenantId);
        }

        if ($actorId = $request->input('actor_id')) {
            $query->where('actor_id', $actorId);
        }

        if ($actorEmail = $request->input('actor_email')) {
            $query->whereHas('actor', fn ($q) => $q->where('email', 'LIKE', "%{$actorEmail}%"));
        }

        if ($event = $request->input('event')) {
            $query->where('event', 'LIKE', "%{$event}%");
        }

        // event_prefixes: comma-separated prefix list, e.g. "auth.*,tenant.*"
        // Each prefix is matched as LIKE 'prefix%' with OR logic.
        if ($rawPrefixes = $request->input('event_prefixes')) {
            $prefixes = array_filter(array_map('trim', explode(',', (string) $rawPrefixes)));
            if (! empty($prefixes)) {
                $query->where(function ($q) use ($prefixes): void {
                    foreach ($prefixes as $prefix) {
                        $q->orWhere('event', 'LIKE', rtrim($prefix, '.*') . '%');
                    }
                });
            }
        }

        if ($from = $request->input('from')) {
            $query->where('created_at', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->where('created_at', '<=', $to . ' 23:59:59');
        }

        if ($request->boolean('export')) {
            return $this->exportCsv(clone $query);
        }

        $paginator = $query
            ->with('actor:id,name,email')
            ->paginate((int) $request->input('per_page', 50));

        $items = collect($paginator->items())->map(fn ($log) => [
            'id'             => $log->id,
            'event'          => $log->event,
            'auditable_type' => $log->auditable_type,
            'auditable_id'   => $log->auditable_id,
            'actor_id'       => $log->actor_id,
            'actor_name'     => $log->actor?->name,
            'actor_email'    => $log->actor?->email,
            'old_values'     => $log->old_values,
            'new_values'     => $log->new_values,
            'ip_address'     => $log->ip_address,
            'tenant_id'      => $log->tenant_id,
            'created_at'     => $log->created_at,
        ])->values();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    private function exportCsv(mixed $query): StreamedResponse
    {
        return response()->stream(function () use ($query): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID', 'Timestamp', 'Event', 'Tenant', 'Actor ID', 'Actor Email', 'IP Address', 'New Values',
            ]);

            $query->with('actor:id,email')->chunk(500, function ($logs) use ($handle): void {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->id,
                        $log->created_at->toISOString(),
                        $log->event,
                        $log->tenant_id ?? '',
                        $log->actor_id ?? '',
                        $log->actor?->email ?? '',
                        $log->ip_address ?? '',
                        json_encode($log->new_values),
                    ]);
                }
            });

            fclose($handle);
        }, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="audit-log-' . now()->format('Y-m-d') . '.csv"',
            'Cache-Control'       => 'no-store',
        ]);
    }
}
