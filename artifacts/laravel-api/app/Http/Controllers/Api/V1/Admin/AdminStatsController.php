<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminStatsController extends Controller
{
    public function index(): JsonResponse
    {
        $tenantCounts = DB::connection('central')
            ->table('tenants')
            ->selectRaw("
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END)           AS active,
                SUM(CASE WHEN status = 'trialing'  THEN 1 ELSE 0 END)           AS trialing,
                SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END)           AS suspended
            ")
            ->first();

        $newThisMonth = DB::connection('central')
            ->table('tenants')
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->count();

        $churnedThisMonth = DB::connection('central')
            ->table('audit_logs')
            ->where('event', 'tenant.suspended')
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->count();

        $totalUsers = DB::connection('central')->table('users')->count();

        // MRR: sum price_cents for all tenants with an active Cashier subscription
        $mrrCents = DB::connection('central')
            ->table('subscriptions')
            ->join('subscription_plans', 'subscriptions.name', '=', 'subscription_plans.key')
            ->where('subscriptions.stripe_status', 'active')
            ->sum('subscription_plans.price_cents');

        $failedPayments = DB::connection('central')
            ->table('subscriptions')
            ->whereIn('stripe_status', ['past_due', 'unpaid'])
            ->count();

        $queuedJobs = DB::connection('central')
            ->table('jobs')
            ->count();

        // Open support tickets: count opened minus closed audit events
        $ticketsOpened = DB::connection('central')
            ->table('audit_logs')
            ->where('event', 'support.ticket.opened')
            ->count();

        $ticketsClosed = DB::connection('central')
            ->table('audit_logs')
            ->where('event', 'support.ticket.closed')
            ->count();

        $openSupportTickets = (int) max(0, $ticketsOpened - $ticketsClosed);

        return response()->json([
            'data' => [
                'total_tenants'        => (int) ($tenantCounts->total     ?? 0),
                'active_tenants'       => (int) ($tenantCounts->active    ?? 0),
                'trial_tenants'        => (int) ($tenantCounts->trialing  ?? 0),
                'suspended_tenants'    => (int) ($tenantCounts->suspended ?? 0),
                'new_this_month'       => $newThisMonth,
                'churned_this_month'   => $churnedThisMonth,
                'mrr_cents'            => (int) $mrrCents,
                'failed_payments'      => $failedPayments,
                'total_users'          => $totalUsers,
                'queued_jobs'          => $queuedJobs,
                'open_support_tickets' => $openSupportTickets,
            ],
        ]);
    }
}
