import { useQuery } from "@tanstack/react-query";
import { adminFetch, type AdminStats } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  DollarSign,
  Inbox,
} from "lucide-react";

function StatCard({
  title,
  value,
  sub,
  icon,
  variant = "default",
  loading,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  variant?: "default" | "warning" | "success" | "danger";
  loading?: boolean;
}) {
  const colors = {
    default: "text-slate-400",
    warning: "text-amber-400",
    success: "text-emerald-400",
    danger:  "text-red-400",
  };

  return (
    <Card className="bg-slate-900 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <span className={colors[variant]}>{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24 bg-slate-800" />
        ) : (
          <div className="text-2xl font-bold text-white">{value}</div>
        )}
        {sub && !loading && (
          <p className="text-xs text-slate-500 mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatMrr(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminFetch<{ data: AdminStats }>("/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time platform KPIs — refreshes every 60 seconds</p>
      </div>

      {/* Tenant KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tenants</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tenants"
            value={data?.total_tenants ?? 0}
            icon={<Building2 className="w-4 h-4" />}
            loading={isLoading}
          />
          <StatCard
            title="Active"
            value={data?.active_tenants ?? 0}
            icon={<Activity className="w-4 h-4" />}
            variant="success"
            loading={isLoading}
          />
          <StatCard
            title="Trialing"
            value={data?.trial_tenants ?? 0}
            icon={<TrendingUp className="w-4 h-4" />}
            variant="warning"
            loading={isLoading}
          />
          <StatCard
            title="Suspended"
            value={data?.suspended_tenants ?? 0}
            icon={<AlertTriangle className="w-4 h-4" />}
            variant="danger"
            loading={isLoading}
          />
        </div>
      </div>

      {/* Growth */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Growth (This Month)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="New Signups"
            value={data?.new_this_month ?? 0}
            icon={<TrendingUp className="w-4 h-4" />}
            variant="success"
            loading={isLoading}
          />
          <StatCard
            title="Churned"
            value={data?.churned_this_month ?? 0}
            icon={<TrendingDown className="w-4 h-4" />}
            variant="danger"
            loading={isLoading}
          />
          <StatCard
            title="Total Users"
            value={data?.total_users ?? 0}
            icon={<Users className="w-4 h-4" />}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Revenue & ops */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Revenue & Operations</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="MRR"
            value={data ? formatMrr(data.mrr_cents) : "$0"}
            sub="Monthly recurring revenue"
            icon={<DollarSign className="w-4 h-4" />}
            variant="success"
            loading={isLoading}
          />
          <StatCard
            title="Failed Payments"
            value={data?.failed_payments ?? 0}
            sub="Past due or unpaid subscriptions"
            icon={<AlertTriangle className="w-4 h-4" />}
            variant={data && data.failed_payments > 0 ? "danger" : "default"}
            loading={isLoading}
          />
          <StatCard
            title="Queued Jobs"
            value={data?.queued_jobs ?? 0}
            sub="Jobs pending in the queue"
            icon={<Inbox className="w-4 h-4" />}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
