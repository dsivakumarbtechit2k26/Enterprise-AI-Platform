import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFetch,
  type AdminTenantDetail,
  type AdminAuditLog,
  type ImpersonationResult,
  type PaginatedResponse,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  User,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  UserCog,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  trialing:  "bg-amber-400/10  text-amber-400  border-amber-400/20",
  suspended: "bg-red-400/10    text-red-400    border-red-400/20",
};

const PLANS = [
  "free", "trial", "professional_monthly", "professional_yearly", "enterprise",
];

function QuotaRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 tabular-nums">
          {used.toLocaleString()} / {max != null ? max.toLocaleString() : "∞"}
        </span>
      </div>
      {max != null && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab,            setActiveTab]            = useState("overview");
  const [planDialogOpen,       setPlanDialogOpen]       = useState(false);
  const [newPlan,              setNewPlan]              = useState("");
  const [suspendDialogOpen,    setSuspendDialogOpen]    = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [resetUserId,          setResetUserId]          = useState<number | null>(null);
  const [auditPage,            setAuditPage]            = useState(1);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["admin", "tenant", tenantId],
    queryFn: () =>
      adminFetch<{ data: AdminTenantDetail }>(`/tenants/${tenantId}`).then((r) => r.data),
    enabled: !!tenantId,
  });

  // Lazy-loaded per-tenant audit trail — only fetches when user clicks the tab
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["admin", "tenant-audit", tenantId, auditPage],
    queryFn: () =>
      adminFetch<PaginatedResponse<AdminAuditLog>>(
        `/audit-logs?tenant_id=${tenantId}&per_page=20&page=${auditPage}`,
      ),
    enabled: activeTab === "audit" && !!tenantId,
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "tenant", tenantId] });
    qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      adminFetch(`/tenants/${tenantId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, status) => {
      toast({ title: `Tenant ${status}` });
      setSuspendDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const planMutation = useMutation({
    mutationFn: (plan: string) =>
      adminFetch(`/tenants/${tenantId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      }),
    onSuccess: () => {
      toast({ title: "Plan updated" });
      setPlanDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ data: ImpersonationResult }>(`/tenants/${tenantId}/impersonate`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: (result) => {
      setImpersonateDialogOpen(false);
      // Pass the one-time exchange code (NOT a bearer token) to the callback page
      const params = new URLSearchParams({
        code:        result.exchange_code,
        tenant_name: result.tenant_name,
        user_name:   result.user_name,
      });
      window.open(`/impersonate?${params}`, "_blank");
    },
    onError: (e: Error) => toast({ title: "Impersonation failed", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: number) =>
      adminFetch(`/users/${userId}/reset-password`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Password reset email sent" });
      setResetUserId(null);
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-64 bg-slate-800" />
      </div>
    );
  }

  if (!tenant) return null;

  const quota = tenant.quota_usage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white mt-0.5"
            onClick={() => navigate("/admin/tenants")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[tenant.status] ?? ""}`}>
                {tenant.status}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">{tenant.id} · {tenant.plan}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/10"
            onClick={() => setImpersonateDialogOpen(true)}
          >
            <UserCog className="w-3.5 h-3.5 mr-1.5" /> Impersonate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/10"
            onClick={() => { setNewPlan(tenant.plan); setPlanDialogOpen(true); }}
          >
            Change Plan
          </Button>
          {tenant.status === "suspended" ? (
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
              onClick={() => statusMutation.mutate("active")}
              disabled={statusMutation.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Reactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-red-400/30 text-red-400 hover:bg-red-400/10"
              onClick={() => setSuspendDialogOpen(true)}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Suspend
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-slate-800 border border-white/10 flex-wrap h-auto">
          <TabsTrigger value="overview"      className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Overview</TabsTrigger>
          <TabsTrigger value="users"         className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Users ({tenant.user_count})</TabsTrigger>
          <TabsTrigger value="quota"         className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Quota Usage</TabsTrigger>
          <TabsTrigger value="subscription"  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Subscription</TabsTrigger>
          <TabsTrigger value="audit"         className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Audit Trail</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ["Tenant ID",    tenant.id],
              ["Name",         tenant.name],
              ["Status",       tenant.status],
              ["Plan",         tenant.plan],
              ["Stripe ID",    tenant.stripe_id ?? "—"],
              ["PM Type",      tenant.pm_type ?? "—"],
              ["PM Last Four", tenant.pm_last_four ? `•••• ${tenant.pm_last_four}` : "—"],
              ["Trial Ends",   tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : "—"],
              ["Sub Ends",     tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at).toLocaleDateString() : "—"],
              ["Created",      new Date(tenant.created_at).toLocaleDateString()],
              ["Updated",      new Date(tenant.updated_at).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-sm text-white font-medium truncate">{value}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Users ── */}
        <TabsContent value="users">
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                  <TableHead className="text-slate-400 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.users.length === 0 ? (
                  <TableRow className="border-white/10">
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  tenant.users.map((u) => (
                    <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500 shrink-0" />
                          <div>
                            <p className="text-white text-sm">{u.name}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-slate-500">{u.email}</p>
                              {u.email_verified && (
                                <ShieldCheck className="w-3 h-3 text-emerald-500" aria-label="Email verified" />
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-300 text-sm capitalize">{u.role}</span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-400 hover:text-amber-400 hover:bg-amber-400/10"
                          title="Send password reset email"
                          onClick={() => setResetUserId(u.id)}
                        >
                          <KeyRound className="w-3 h-3 mr-1" /> Reset
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Quota Usage ── */}
        <TabsContent value="quota" className="space-y-5">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">User Quota</h3>
              <QuotaRow
                label="Users"
                used={quota.user_count}
                max={quota.max_users}
              />
            </div>

            {Object.keys(quota.plan_features).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Plan Limits</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(quota.plan_features).map(([key, value]) => (
                    <div key={key} className="bg-slate-800 rounded-md p-3">
                      <p className="text-xs text-slate-500 mb-1 font-mono">{key}</p>
                      <p className="text-sm text-white font-medium">
                        {value === "-1" ? "Unlimited" : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(quota.plan_features).length === 0 && (
              <p className="text-slate-500 text-sm">
                No plan features configured for plan <span className="font-mono text-slate-400">{tenant.plan}</span>.
              </p>
            )}
          </div>
        </TabsContent>

        {/* ── Subscription ── */}
        <TabsContent value="subscription" className="space-y-4">
          {tenant.subscription ? (
            <div className="bg-slate-900 border border-white/10 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Active Subscription</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Stripe Status", tenant.subscription.stripe_status],
                  ["Plan Key",      tenant.subscription.name],
                  ["Created",       new Date(tenant.subscription.created_at).toLocaleDateString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className="text-sm text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-white/10 rounded-lg p-5 text-center text-slate-500">
              No active subscription
            </div>
          )}

          {/* Subscription history events */}
          {tenant.subscription_history.length > 0 && (
            <div className="bg-slate-900 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Subscription History</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-36">Date</TableHead>
                    <TableHead className="text-slate-400">Event</TableHead>
                    <TableHead className="text-slate-400 hidden md:table-cell">Actor</TableHead>
                    <TableHead className="text-slate-400 hidden md:table-cell">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.subscription_history.map((ev) => (
                    <TableRow key={ev.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-slate-500 text-xs tabular-nums whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className="text-white text-sm font-mono">{ev.event}</span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm hidden md:table-cell">
                        {ev.actor_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs hidden md:table-cell">
                        {ev.new_values && Object.keys(ev.new_values).length > 0
                          ? Object.entries(ev.new_values)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Audit Trail ── */}
        <TabsContent value="audit" className="space-y-4">
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400 w-36">Timestamp</TableHead>
                  <TableHead className="text-slate-400">Event</TableHead>
                  <TableHead className="text-slate-400 hidden md:table-cell">Actor</TableHead>
                  <TableHead className="text-slate-400 hidden md:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i} className="border-white/10">
                        <TableCell><Skeleton className="h-4 w-28 bg-slate-800" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40 bg-slate-800" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24 bg-slate-800" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20 bg-slate-800" /></TableCell>
                      </TableRow>
                    ))
                  : auditData?.data.length === 0
                  ? (
                    <TableRow className="border-white/10">
                      <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                        No audit events for this tenant
                      </TableCell>
                    </TableRow>
                  )
                  : auditData?.data.map((log) => (
                      <TableRow key={log.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-slate-500 text-xs tabular-nums whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className="text-white text-sm font-mono">{log.event}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div>
                            <p className="text-slate-300 text-sm">{log.actor_name ?? "—"}</p>
                            {log.actor_email && (
                              <p className="text-xs text-slate-600">{log.actor_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs hidden md:table-cell">
                          {log.ip_address ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          {auditData && auditData.meta.last_page > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                Page {auditData.meta.current_page} of {auditData.meta.last_page} ({auditData.meta.total} events)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                  disabled={auditPage === 1}
                  onClick={() => setAuditPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                  disabled={auditPage === auditData.meta.last_page}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Suspend */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Suspend Tenant</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will suspend <strong className="text-white">{tenant.name}</strong>. Their users will be unable to log in until reactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => statusMutation.mutate("suspended")}
              disabled={statusMutation.isPending}
            >
              Suspend Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change plan */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Change Plan</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a new plan for <strong className="text-white">{tenant.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Select value={newPlan} onValueChange={setNewPlan}>
            <SelectTrigger className="bg-slate-800 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => planMutation.mutate(newPlan)}
              disabled={planMutation.isPending || !newPlan}
            >
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonate confirmation */}
      <Dialog open={impersonateDialogOpen} onOpenChange={setImpersonateDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Impersonate Tenant</DialogTitle>
            <DialogDescription className="text-slate-400">
              You will be logged in as the admin/owner of <strong className="text-white">{tenant.name}</strong> in a new tab.
              A one-time exchange code is issued (expires 60 s), which your browser redeems for a 15-minute session.
              This action is permanently logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImpersonateDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => impersonateMutation.mutate()}
              disabled={impersonateMutation.isPending}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open Impersonated Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password confirmation */}
      <Dialog open={resetUserId !== null} onOpenChange={(o) => !o && setResetUserId(null)}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Send Password Reset</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will send a password reset email to the user. They will need to check their inbox.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUserId(null)}>Cancel</Button>
            <Button
              onClick={() => resetUserId !== null && resetPasswordMutation.mutate(resetUserId)}
              disabled={resetPasswordMutation.isPending}
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
              Send Reset Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
