import { useState, useCallback } from "react";
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

// ── Event category definitions ────────────────────────────────────────────────

const EVENT_CATEGORIES: { label: string; prefix: string }[] = [
  { label: "Auth",           prefix: "auth"              },
  { label: "Tenant",         prefix: "tenant"            },
  { label: "Subscription",   prefix: "subscription"      },
  { label: "Invoice / Pay",  prefix: "invoice"           },
  { label: "Billing",        prefix: "billing"           },
  { label: "User",           prefix: "user"              },
  { label: "Settings",       prefix: "platform_settings" },
  { label: "Support",        prefix: "support"           },
];

// ── Row shape passed via rowProps ─────────────────────────────────────────────

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
      <span className="text-white text-xs font-mono truncate flex-1 min-w-0">
        {log.event}
      </span>
      <span className="text-slate-400 text-xs w-32 shrink-0 truncate hidden lg:block">
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
  const [tenantId,      setTenantId]      = useState("");
  const [eventText,     setEventText]     = useState("");
  const [eventPrefixes, setEventPrefixes] = useState<Set<string>>(new Set());
  const [actorEmail,    setActorEmail]    = useState("");
  const [from,          setFrom]          = useState("");
  const [to,            setTo]            = useState("");
  const [page,          setPage]          = useState(1);
  const [detail,        setDetail]        = useState<AdminAuditLog | null>(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  const token = useAuthStore((s) => s.token);

  const togglePrefix = useCallback((prefix: string) => {
    setEventPrefixes((prev) => {
      const next = new Set(prev);
      next.has(prefix) ? next.delete(prefix) : next.add(prefix);
      return next;
    });
    setPage(1);
  }, []);

  const activeFilterCount =
    (tenantId              ? 1 : 0) +
    (eventText             ? 1 : 0) +
    (eventPrefixes.size > 0 ? 1 : 0) +
    (actorEmail            ? 1 : 0) +
    (from                  ? 1 : 0) +
    (to                    ? 1 : 0);

  const params = new URLSearchParams({
    page:     String(page),
    per_page: "100",
    ...(tenantId                  ? { tenant_id:     tenantId }                       : {}),
    ...(eventText                 ? { event:         eventText }                      : {}),
    ...(eventPrefixes.size > 0    ? { event_prefixes: [...eventPrefixes].join(",") } : {}),
    ...(actorEmail                ? { actor_email:   actorEmail }                     : {}),
    ...(from                      ? { from }                                           : {}),
    ...(to                        ? { to }                                             : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", tenantId, eventText, [...eventPrefixes].join(","), actorEmail, from, to, page],
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
    setTenantId(""); setEventText(""); setEventPrefixes(new Set());
    setActorEmail(""); setFrom(""); setTo(""); setPage(1);
  };

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
            onClick={() => setSidebarOpen((o) => !o)}
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

            {/* Tenant ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Tenant ID
              </label>
              <Input
                value={tenantId}
                onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
                placeholder="Filter by tenant…"
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm h-8"
              />
            </div>

            {/* Event text search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Event (text match)
              </label>
              <Input
                value={eventText}
                onChange={(e) => { setEventText(e.target.value); setPage(1); }}
                placeholder="e.g. tenant.suspended"
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm h-8"
              />
            </div>

            {/* Event category multi-select */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Event Categories
              </label>
              <div className="space-y-1">
                {EVENT_CATEGORIES.map(({ label, prefix }) => {
                  const checked = eventPrefixes.has(prefix);
                  return (
                    <label
                      key={prefix}
                      className="flex items-center gap-2.5 cursor-pointer group py-0.5"
                      onClick={() => togglePrefix(prefix)}
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
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Actor email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Actor Email
              </label>
              <Input
                value={actorEmail}
                onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
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
                  onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                  className="bg-slate-800 border-white/10 text-white text-sm h-8"
                  title="From"
                />
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setPage(1); }}
                  className="bg-slate-800 border-white/10 text-white text-sm h-8"
                  title="To"
                />
              </div>
            </div>
          </aside>
        )}

        {/* ── Virtualized table ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
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
                rowProps={{ items: rows, onDetail: setDetail }}
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
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                  disabled={page === data.meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-mono text-sm">{detail?.event}</DialogTitle>
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
