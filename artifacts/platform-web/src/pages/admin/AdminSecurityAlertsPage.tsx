import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminFetch, type AdminAuditLog, type PaginatedResponse } from "@/lib/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldAlert,
  ShieldX,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
} from "lucide-react";

// ── Alert type config ──────────────────────────────────────────────────────────

interface AlertConfig {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  ring: string;
}

const ALERT_TYPE_CONFIG: Record<string, AlertConfig> = {
  login_failure: {
    label: "Login Failures",
    icon:  <ShieldAlert className="w-3.5 h-3.5" />,
    bg:    "bg-amber-500/15",
    text:  "text-amber-300",
    ring:  "ring-amber-500/30",
  },
  account_locked: {
    label: "Account Locked",
    icon:  <ShieldX className="w-3.5 h-3.5" />,
    bg:    "bg-red-500/15",
    text:  "text-red-300",
    ring:  "ring-red-500/30",
  },
  payment_failed: {
    label: "Payment Failed",
    icon:  <CreditCard className="w-3.5 h-3.5" />,
    bg:    "bg-orange-500/15",
    text:  "text-orange-300",
    ring:  "ring-orange-500/30",
  },
};

function alertConfig(alertType?: string): AlertConfig {
  return ALERT_TYPE_CONFIG[alertType ?? ""] ?? {
    label: alertType ?? "Unknown",
    icon:  <AlertTriangle className="w-3.5 h-3.5" />,
    bg:    "bg-slate-700/40",
    text:  "text-slate-300",
    ring:  "ring-slate-600/30",
  };
}

// ── Alert type badge ───────────────────────────────────────────────────────────

function AlertTypeBadge({ alertType }: { alertType?: string }) {
  const cfg = alertConfig(alertType);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset shrink-0 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractContext(log: AdminAuditLog): {
  alertType: string | undefined;
  notifiedEmail: string | undefined;
  failureCount: number | undefined;
  threshold: number | undefined;
  invoiceId: string | undefined;
  attemptCount: number | undefined;
} {
  const v = log.new_values ?? {};
  return {
    alertType:     typeof v["alert_type"]      === "string" ? v["alert_type"]      : undefined,
    notifiedEmail: typeof v["notified_email"]  === "string" ? v["notified_email"]  : undefined,
    failureCount:  typeof v["failure_count"]   === "number" ? v["failure_count"]   : undefined,
    threshold:     typeof v["threshold"]       === "number" ? v["threshold"]       : undefined,
    invoiceId:     typeof v["invoice_id"]      === "string" ? v["invoice_id"]      : undefined,
    attemptCount:  typeof v["attempt_count"]   === "number" ? v["attempt_count"]   : undefined,
  };
}

// ── Detail dialog ──────────────────────────────────────────────────────────────

function DetailDialog({
  log,
  onClose,
}: {
  log: AdminAuditLog | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Alert Detail
          </DialogTitle>
        </DialogHeader>
        {log && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-slate-500">Time</span>
              <span>{new Date(log.created_at).toLocaleString()}</span>
              <span className="text-slate-500">Alert Type</span>
              <AlertTypeBadge alertType={extractContext(log).alertType} />
              <span className="text-slate-500">Actor</span>
              <span>{log.actor_name ?? log.actor_email ?? "—"}</span>
              {log.actor_email && log.actor_name && (
                <>
                  <span className="text-slate-500">Actor Email</span>
                  <span className="text-slate-300">{log.actor_email}</span>
                </>
              )}
              <span className="text-slate-500">IP Address</span>
              <span className="font-mono">{log.ip_address ?? "—"}</span>
              {log.tenant_id && (
                <>
                  <span className="text-slate-500">Tenant</span>
                  <span className="font-mono text-xs">{log.tenant_id}</span>
                </>
              )}
            </div>

            {log.new_values && (
              <div className="rounded-lg bg-slate-800 border border-white/5 p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Context
                </p>
                <pre className="text-xs text-slate-300 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(log.new_values, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PER_PAGE = 50;

export default function AdminSecurityAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<AdminAuditLog | null>(null);

  const page = Number(searchParams.get("page") ?? "1");

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const params = new URLSearchParams({
    page:          String(page),
    per_page:      String(PER_PAGE),
    event_prefixes: "security.alert",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "security-alerts", page],
    queryFn: () => adminFetch<PaginatedResponse<AdminAuditLog>>(`/audit-logs?${params}`),
    placeholderData: (prev) => prev,
  });

  const rows       = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.last_page ?? 1;
  const total      = meta?.total ?? 0;

  return (
    <div className="space-y-4" data-testid="page-security-alerts">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            Security Alerts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLoading ? "Loading…" : `${total} alerts recorded`}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider w-36 shrink-0">
            Timestamp
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider w-36 shrink-0">
            Alert Type
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex-1">
            Affected User / Actor
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider w-28 shrink-0 hidden lg:block">
            IP Address
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider w-48 shrink-0 hidden xl:block truncate">
            Tenant
          </span>
          <span className="w-8 shrink-0" />
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-slate-800" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No security alerts recorded</p>
            <p className="text-slate-600 text-xs mt-1">
              Alerts fire when login thresholds are exceeded or accounts are locked.
            </p>
          </div>
        ) : (
          <div>
            {rows.map((log) => {
              const ctx = extractContext(log);
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 border-b border-white/5 px-4 py-3 hover:bg-white/5 transition-colors last:border-0"
                >
                  <span className="text-slate-500 text-xs tabular-nums whitespace-nowrap w-36 shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </span>

                  <div className="w-36 shrink-0">
                    <AlertTypeBadge alertType={ctx.alertType} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {log.actor_name || log.actor_email ? (
                      <>
                        <p className="text-white text-xs truncate">{log.actor_name ?? log.actor_email}</p>
                        {log.actor_name && log.actor_email && (
                          <p className="text-slate-500 text-xs truncate">{log.actor_email}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </div>

                  <span className="text-slate-400 text-xs font-mono w-28 shrink-0 truncate hidden lg:block">
                    {log.ip_address ?? "—"}
                  </span>

                  <span className="text-slate-500 text-xs font-mono w-48 shrink-0 truncate hidden xl:block" title={log.tenant_id ?? undefined}>
                    {log.tenant_id ?? "—"}
                  </span>

                  <div className="w-8 shrink-0 flex justify-end">
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded"
                      onClick={() => setDetail(log)}
                      title="View details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 border-white/10"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 border-white/10"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <DetailDialog log={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
