import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { List, type RowComponentProps } from "react-window";
import { adminFetch, type AdminAuditLog, type PaginatedResponse } from "@/lib/adminApi";
import { useAuthStore } from "@/stores/authStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, Eye, Filter, X } from "lucide-react";

// ── Event label map ───────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  // Auth
  "auth.login.success":       "Login Successful",
  "auth.login.failed":        "Login Failed",
  "auth.login.mfa_required":  "MFA Required",
  "auth.logout":              "Logged Out",
  "auth.email.verified":      "Email Verified",
  "auth.password.reset":      "Password Reset",
  "auth.password.changed":    "Password Changed",
  "auth.mfa.enabled":         "MFA Enabled",
  "auth.mfa.disabled":        "MFA Disabled",
  "auth.token.created":       "API Token Created",
  "auth.token.revoked":       "API Token Revoked",
  // User
  "user.registered":          "User Registered",
  "user.updated":             "User Updated",
  "user.deleted":             "User Deleted",
  "user.impersonated":        "User Impersonated",
  "user.password.reset":      "Admin Password Reset",
  // Tenant
  "tenant.provisioned":       "Tenant Provisioned",
  "tenant.active":            "Tenant Activated",
  "tenant.suspended":         "Tenant Suspended",
  "tenant.expired":           "Tenant Expired",
  "tenant.plan_changed":      "Plan Changed",
  "tenant.impersonated":      "Tenant Impersonated",
  "tenant.deleted":           "Tenant Deleted",
  // RBAC
  "role.assigned":            "Role Assigned",
  "role.revoked":             "Role Revoked",
  "role.created":             "Role Created",
  "role.updated":             "Role Updated",
  "role.deleted":             "Role Deleted",
  "permission.granted":       "Permission Granted",
  "permission.revoked":       "Permission Revoked",
  "field_permission.updated": "Field Permission Updated",
  // Billing
  "billing.checkout.started":             "Checkout Started",
  "billing.checkout.completed":           "Checkout Completed",
  "billing.subscription.created":         "Subscription Created",
  "billing.subscription.updated":         "Subscription Updated",
  "billing.subscription.cancelled":       "Subscription Cancelled",
  "billing.subscription.expired":         "Subscription Expired",
  "billing.subscription.resumed":         "Subscription Resumed",
  "billing.invoice.paid":                 "Invoice Paid",
  "billing.invoice.payment_failed":       "Invoice Payment Failed",
  "billing.payment_method.updated":       "Payment Method Updated",
  // Subscription (alternate prefix)
  "subscription.created":   "Subscription Created",
  "subscription.updated":   "Subscription Updated",
  "subscription.cancelled": "Subscription Cancelled",
  "subscription.expired":   "Subscription Expired",
  // Settings
  "platform_settings.updated":   "Platform Settings Updated",
  "platform_settings.smtp_test": "SMTP Test Sent",
  // Support
  "support.ticket.created": "Support Ticket Created",
  "support.ticket.closed":  "Support Ticket Closed",
  // Security alerts
  "security.alert.fired": "Security Alert Fired",
};

function eventLabel(event: string): string {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  // Fallback: convert "some.event.key" → "Some Event Key"
  return event
    .split(".")
    .map((part) => part.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" › ");
}

// ── Category badge config ─────────────────────────────────────────────────────

type Category = "auth" | "tenant" | "billing" | "rbac" | "user" | "settings" | "support" | "security" | "other";

const CATEGORY_STYLES: Record<Category, { bg: string; text: string; ring: string; label: string }> = {
  auth:     { bg: "bg-blue-500/15",   text: "text-blue-300",   ring: "ring-blue-500/30",   label: "Auth"     },
  tenant:   { bg: "bg-purple-500/15", text: "text-purple-300", ring: "ring-purple-500/30", label: "Tenant"   },
  billing:  { bg: "bg-emerald-500/15",text: "text-emerald-300",ring: "ring-emerald-500/30",label: "Billing"  },
  rbac:     { bg: "bg-amber-500/15",  text: "text-amber-300",  ring: "ring-amber-500/30",  label: "RBAC"     },
  user:     { bg: "bg-sky-500/15",    text: "text-sky-300",    ring: "ring-sky-500/30",    label: "User"     },
  settings: { bg: "bg-slate-500/15",  text: "text-slate-300",  ring: "ring-slate-500/30",  label: "Settings" },
  support:  { bg: "bg-rose-500/15",   text: "text-rose-300",   ring: "ring-rose-500/30",   label: "Support"  },
  security: { bg: "bg-red-500/15",    text: "text-red-300",    ring: "ring-red-500/30",    label: "Security" },
  other:    { bg: "bg-slate-700/30",  text: "text-slate-400",  ring: "ring-slate-600/30",  label: "Other"    },
};

const PREFIX_TO_CATEGORY: [string, Category][] = [
  ["auth",              "auth"],
  ["tenant",            "tenant"],
  ["billing",           "billing"],
  ["subscription",      "billing"],
  ["invoice",           "billing"],
  ["role",              "rbac"],
  ["permission",        "rbac"],
  ["field_permission",  "rbac"],
  ["user",              "user"],
  ["platform_settings", "settings"],
  ["support",           "support"],
  ["security",          "security"],
];

function getCategory(event: string): Category {
  for (const [prefix, cat] of PREFIX_TO_CATEGORY) {
    if (event === prefix || event.startsWith(`${prefix}.`)) return cat;
  }
  return "other";
}

function CategoryBadge({ event }: { event: string }) {
  const cat = getCategory(event);
  const style = CATEGORY_STYLES[cat];
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset shrink-0 ${style.bg} ${style.text} ${style.ring}`}
    >
      {style.label}
    </span>
  );
}

// ── Event category definitions (for sidebar filter) ───────────────────────────
// Each category maps to ALL of the prefixes that belong to it so that selecting
// "Billing" or "RBAC" captures every related event, not just a single prefix.

const EVENT_CATEGORIES: { label: string; prefixes: string[]; category: Category }[] = [
  { label: "Auth",     prefixes: ["auth"],                                          category: "auth"     },
  { label: "Tenant",   prefixes: ["tenant"],                                        category: "tenant"   },
  { label: "Billing",  prefixes: ["billing", "subscription", "invoice"],            category: "billing"  },
  { label: "RBAC",     prefixes: ["role", "permission", "field_permission"],        category: "rbac"     },
  { label: "User",     prefixes: ["user"],                                          category: "user"     },
  { label: "Settings", prefixes: ["platform_settings"],                             category: "settings" },
  { label: "Support",  prefixes: ["support"],                                       category: "support"  },
  { label: "Security", prefixes: ["security"],                                      category: "security" },
];

// ── Row shape ─────────────────────────────────────────────────────────────────

interface AuditRowProps {
  items: AdminAuditLog[];
  onDetail: (log: AdminAuditLog) => void;
}

function AuditRow({
  index,
  style,
  items,
  onDetail,
}: RowComponentProps<AuditRowProps>) {
  const log = items[index];
  if (!log) return null;

  return (
    <div
      style={style}
      className="flex items-center gap-3 border-b border-white/5 px-4 hover:bg-white/5 transition-colors"
    >
      <span className="text-slate-500 text-xs tabular-nums whitespace-nowrap w-36 shrink-0">
        {new Date(log.created_at).toLocaleString()}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CategoryBadge event={log.event} />
        <span className="text-white text-xs truncate" title={log.event}>
          {eventLabel(log.event)}
        </span>
      </div>
      <span className="text-slate-400 text-xs w-32 shrink-0 truncate hidden lg:block" title={log.tenant_id ?? undefined}>
        {log.tenant_id ?? "—"}
      </span>
      <div className="w-40 shrink-0 hidden md:block">
        <p className="text-slate-300 text-xs truncate">{log.actor_name ?? "—"}</p>
        {log.actor_email && (
          <p className="text-slate-600 text-xs truncate">{log.actor_email}</p>
        )}
      </div>
      <span className="text-slate-500 text-xs w-28 shrink-0 hidden xl:block">
        {log.ip_address ?? "—"}
      </span>
      <div className="w-8 shrink-0 flex justify-end">
        {(log.new_values || log.old_values) && (
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded"
            onClick={() => onDetail(log)}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useAuthStore((s) => s.token);

  // Read filter state from URL
  // Categories are stored by name (e.g. "billing,rbac"); prefixes are derived at query time.
  const tenantId       = searchParams.get("tenant_id")   ?? "";
  const eventText      = searchParams.get("event")       ?? "";
  const actorEmail     = searchParams.get("actor_email") ?? "";
  const from           = searchParams.get("from")        ?? "";
  const to             = searchParams.get("to")          ?? "";
  const page           = Number(searchParams.get("page") ?? "1");
  const sidebarOpen    = searchParams.get("sidebar") !== "0";
  const selectedCategories = useMemo(() => {
    const raw = searchParams.get("categories");
    return raw ? new Set<Category>(raw.split(",").filter(Boolean) as Category[]) : new Set<Category>();
  }, [searchParams]);

  // Expand selected categories → flat list of prefixes sent to the API
  const expandedPrefixes = useMemo(() => {
    const out: string[] = [];
    for (const cat of selectedCategories) {
      const def = EVENT_CATEGORIES.find((c) => c.category === cat);
      if (def) out.push(...def.prefixes);
    }
    return out;
  }, [selectedCategories]);

  // Helper to patch one or more params without clobbering others
  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === "") next.delete(k);
          else next.set(k, v);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const toggleCategory = useCallback((cat: Category) => {
    setParam({
      categories: (() => {
        const next = new Set(selectedCategories);
        next.has(cat) ? next.delete(cat) : next.add(cat);
        return next.size > 0 ? [...next].join(",") : null;
      })(),
      page: null,
    });
  }, [selectedCategories, setParam]);

  const activeFilterCount =
    (tenantId                   ? 1 : 0) +
    (eventText                  ? 1 : 0) +
    (selectedCategories.size > 0 ? 1 : 0) +
    (actorEmail                 ? 1 : 0) +
    (from                       ? 1 : 0) +
    (to                         ? 1 : 0);

  const params = new URLSearchParams({
    page:     String(page),
    per_page: "100",
    ...(tenantId                    ? { tenant_id:      tenantId }                       : {}),
    ...(eventText                   ? { event:          eventText }                      : {}),
    ...(expandedPrefixes.length > 0 ? { event_prefixes: expandedPrefixes.join(",") }     : {}),
    ...(actorEmail                  ? { actor_email:    actorEmail }                     : {}),
    ...(from                        ? { from }                                            : {}),
    ...(to                          ? { to }                                              : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", tenantId, eventText, expandedPrefixes.join(","), actorEmail, from, to, page],
    queryFn:  () => adminFetch<PaginatedResponse<AdminAuditLog>>(`/audit-logs?${params}`),
    placeholderData: (prev) => prev,
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams({ ...Object.fromEntries(params), export: "1" });
    fetch(`/api/v1/admin/audit-logs?${exportParams}`, {
      headers: { Authorization: `Bearer ${token ?? ""}`, Accept: "text/csv" },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      });
  };

  const handleReset = () => {
    setSearchParams({ sidebar: sidebarOpen ? "1" : "0" }, { replace: true });
  };

  // Open detail dialog via URL param
  const detailId = searchParams.get("detail");
  const detail   = detailId ? (data?.data ?? []).find((l) => String(l.id) === detailId) ?? null : null;

  const rows       = data?.data ?? [];
  const listHeight = Math.min(600, Math.max(200, rows.length * 56 + 1));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.meta.total ?? "…"} events recorded</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/10"
            onClick={() => setParam({ sidebar: sidebarOpen ? "0" : "1" })}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0 leading-4">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/10"
            onClick={handleExport}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Filter Sidebar ──────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 space-y-5 bg-slate-900 border border-white/10 rounded-xl p-4 h-fit sticky top-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Filters</h3>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  onClick={handleReset}
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>

            {/* Event Categories multi-select */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Event Category
              </label>
              <div className="space-y-1">
                {EVENT_CATEGORIES.map(({ label, category }) => {
                  const checked = selectedCategories.has(category);
                  const style   = CATEGORY_STYLES[category];
                  return (
                    <label
                      key={category}
                      className="flex items-center gap-2.5 cursor-pointer group py-0.5"
                      onClick={() => toggleCategory(category)}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? "bg-primary border-primary"
                            : "border-white/20 bg-slate-800 group-hover:border-white/40"
                        }`}
                      >
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}>
                        {style.label}
                      </span>
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Tenant ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Tenant
              </label>
              <Input
                value={tenantId}
                onChange={(e) => setParam({ tenant_id: e.target.value, page: null })}
                placeholder="Filter by tenant ID…"
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm h-8"
              />
            </div>

            {/* Event text search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Event Key
              </label>
              <Input
                value={eventText}
                onChange={(e) => setParam({ event: e.target.value, page: null })}
                placeholder="e.g. tenant.suspended"
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm h-8"
              />
            </div>

            {/* Actor email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Actor Email
              </label>
              <Input
                value={actorEmail}
                onChange={(e) => setParam({ actor_email: e.target.value, page: null })}
                placeholder="Filter by actor…"
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm h-8"
              />
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Date Range
              </label>
              <div className="space-y-1.5">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setParam({ from: e.target.value, page: null })}
                  className="bg-slate-800 border-white/10 text-white text-sm h-8"
                  title="From"
                />
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setParam({ to: e.target.value, page: null })}
                  className="bg-slate-800 border-white/10 text-white text-sm h-8"
                  title="To"
                />
              </div>
            </div>
          </aside>
        )}

        {/* ── Virtualized table ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...selectedCategories].map((cat) => {
                const def   = EVENT_CATEGORIES.find((c) => c.category === cat);
                const style = CATEGORY_STYLES[cat];
                return (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}
                  >
                    {def?.label ?? cat}
                    <button type="button" onClick={() => toggleCategory(cat)} className="hover:opacity-70">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
              {tenantId && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset bg-slate-700/40 text-slate-300 ring-slate-600/30">
                  Tenant: {tenantId}
                  <button type="button" onClick={() => setParam({ tenant_id: null })} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {actorEmail && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset bg-slate-700/40 text-slate-300 ring-slate-600/30">
                  Actor: {actorEmail}
                  <button type="button" onClick={() => setParam({ actor_email: null })} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {eventText && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset bg-slate-700/40 text-slate-300 ring-slate-600/30">
                  Event: {eventText}
                  <button type="button" onClick={() => setParam({ event: null })} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {(from || to) && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset bg-slate-700/40 text-slate-300 ring-slate-600/30">
                  {from && to ? `${from} → ${to}` : from ? `From ${from}` : `Until ${to}`}
                  <button type="button" onClick={() => setParam({ from: null, to: null })} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-900/50 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <span className="text-xs font-medium text-slate-400 w-36 shrink-0">Timestamp</span>
              <span className="text-xs font-medium text-slate-400 flex-1">Event</span>
              <span className="text-xs font-medium text-slate-400 w-32 shrink-0 hidden lg:block">Tenant</span>
              <span className="text-xs font-medium text-slate-400 w-40 shrink-0 hidden md:block">Actor</span>
              <span className="text-xs font-medium text-slate-400 w-28 shrink-0 hidden xl:block">IP</span>
              <span className="w-8 shrink-0" />
            </div>

            {isLoading ? (
              <div>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <Skeleton className="h-3 w-36 bg-slate-800" />
                    <Skeleton className="h-3 flex-1 bg-slate-800" />
                    <Skeleton className="h-3 w-32 bg-slate-800 hidden lg:block" />
                    <Skeleton className="h-3 w-40 bg-slate-800 hidden md:block" />
                  </div>
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                No audit logs match the current filters.
              </div>
            ) : (
              <List
                rowComponent={AuditRow}
                rowCount={rows.length}
                rowHeight={56}
                rowProps={{ items: rows, onDetail: (log) => setParam({ detail: String(log.id) }) }}
                style={{ height: listHeight }}
              />
            )}
          </div>

          {/* Pagination */}
          {data && data.meta.last_page > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.total} events)</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                  disabled={page === 1}
                  onClick={() => setParam({ page: String(page - 1) })}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                  disabled={page === data.meta.last_page}
                  onClick={() => setParam({ page: String(page + 1) })}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setParam({ detail: null })}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              {detail && <CategoryBadge event={detail.event} />}
              <DialogTitle className="text-white text-sm">
                {detail ? eventLabel(detail.event) : ""}
              </DialogTitle>
            </div>
            {detail && (
              <p className="text-slate-500 text-xs font-mono mt-0.5">{detail.event}</p>
            )}
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div><span className="text-slate-500">Tenant: </span>{detail.tenant_id ?? "—"}</div>
                <div><span className="text-slate-500">Actor: </span>{detail.actor_email ?? detail.actor_name ?? "—"}</div>
                <div><span className="text-slate-500">IP: </span>{detail.ip_address ?? "—"}</div>
                <div><span className="text-slate-500">Time: </span>{new Date(detail.created_at).toLocaleString()}</div>
              </div>
              {detail.old_values && Object.keys(detail.old_values).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Before</p>
                  <pre className="bg-slate-800 rounded-md p-3 text-slate-300 text-xs overflow-auto max-h-40">
                    {JSON.stringify(detail.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {detail.new_values && Object.keys(detail.new_values).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">After</p>
                  <pre className="bg-slate-800 rounded-md p-3 text-emerald-400 text-xs overflow-auto max-h-40">
                    {JSON.stringify(detail.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
