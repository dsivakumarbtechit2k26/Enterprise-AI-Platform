import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFetch,
  type AdminTenantDetail,
  type ImpersonationResult,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  trialing:  "bg-amber-400/10  text-amber-400  border-amber-400/20",
  suspended: "bg-red-400/10    text-red-400    border-red-400/20",
};

const PLANS = [
  "free", "trial", "professional_monthly", "professional_yearly", "enterprise",
];

export default function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [newPlan, setNewPlan]               = useState("");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["admin", "tenant", tenantId],
    queryFn: () =>
      adminFetch<{ data: AdminTenantDetail }>(`/tenants/${tenantId}`).then((r) => r.data),
    enabled: !!tenantId,
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
      const params = new URLSearchParams({
        token:       result.token,
        tenant_name: result.tenant_name,
        user_name:   result.user_name,
      });
      window.open(`/impersonate?${params}`, "_blank");
    },
    onError: (e: Error) => toast({ title: "Impersonation failed", description: e.message, variant: "destructive" }),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
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
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-800 border border-white/10">
          <TabsTrigger value="overview"  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Overview</TabsTrigger>
          <TabsTrigger value="users"     className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Users ({tenant.user_count})</TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Subscription</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
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

        {/* Users tab */}
        <TabsContent value="users">
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.users.length === 0 ? (
                  <TableRow className="border-white/10">
                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">
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
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-300 text-sm capitalize">{u.role}</span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Subscription tab */}
        <TabsContent value="subscription">
          {tenant.subscription ? (
            <div className="bg-slate-900 border border-white/10 rounded-lg p-5 space-y-3">
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
            <div className="text-center py-12 text-slate-500">No active subscription</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend dialog */}
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

      {/* Change plan dialog */}
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
              You will be logged in as the admin/owner of <strong className="text-white">{tenant.name}</strong> in a new tab. The session expires in 15 minutes. This action is logged.
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
    </div>
  );
}
