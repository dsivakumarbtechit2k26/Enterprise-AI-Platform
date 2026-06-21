import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch, type AdminAuditLog, type PaginatedResponse } from "@/lib/adminApi";
import { useAuthStore } from "@/stores/authStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, Eye } from "lucide-react";

export default function AdminAuditLogPage() {
  const [tenantId,   setTenantId]   = useState("");
  const [event,      setEvent]      = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");
  const [page,       setPage]       = useState(1);
  const [detail,     setDetail]     = useState<AdminAuditLog | null>(null);

  const token = useAuthStore((s) => s.token);

  const params = new URLSearchParams({
    page: String(page),
    per_page: "50",
    ...(tenantId   ? { tenant_id:   tenantId   } : {}),
    ...(event      ? { event }                   : {}),
    ...(actorEmail ? { actor_email: actorEmail } : {}),
    ...(from       ? { from }                    : {}),
    ...(to         ? { to }                      : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", tenantId, event, actorEmail, from, to, page],
    queryFn: () => adminFetch<PaginatedResponse<AdminAuditLog>>(`/audit-logs?${params}`),
    placeholderData: (prev) => prev,
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams({ ...Object.fromEntries(params), export: "1" });
    const url = `/api/v1/admin/audit-logs?${exportParams}`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    a.setAttribute("rel", "noopener");
    // attach auth header via fetch + blob URL
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        Accept: "text/csv",
      },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      });
  };

  const handleFilterReset = () => {
    setTenantId(""); setEvent(""); setActorEmail(""); setFrom(""); setTo(""); setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.meta.total ?? "…"} events recorded
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 text-slate-300 hover:bg-white/10"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Input
          value={tenantId}
          onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
          placeholder="Tenant ID…"
          className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm"
        />
        <Input
          value={event}
          onChange={(e) => { setEvent(e.target.value); setPage(1); }}
          placeholder="Event type…"
          className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm"
        />
        <Input
          value={actorEmail}
          onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
          placeholder="Actor email…"
          className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500 text-sm"
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="bg-slate-800 border-white/10 text-white text-sm"
          title="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="bg-slate-800 border-white/10 text-white text-sm"
          title="To date"
        />
      </div>
      {(tenantId || event || actorEmail || from || to) && (
        <button
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          onClick={handleFilterReset}
        >
          Clear filters
        </button>
      )}

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400 w-40">Timestamp</TableHead>
              <TableHead className="text-slate-400">Event</TableHead>
              <TableHead className="text-slate-400">Tenant</TableHead>
              <TableHead className="text-slate-400">Actor</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">IP</TableHead>
              <TableHead className="text-slate-400 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-white/10">
                    <TableCell><Skeleton className="h-4 w-32 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28 bg-slate-800" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24 bg-slate-800" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : data?.data.map((log) => (
                  <TableRow key={log.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-slate-500 text-xs tabular-nums whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="text-white text-sm font-mono">{log.event}</span>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{log.tenant_id ?? "—"}</TableCell>
                    <TableCell>
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
                    <TableCell>
                      {(log.new_values || log.old_values) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={() => setDetail(log)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-slate-900 border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white font-mono text-sm">{detail?.event}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              {detail.old_values && Object.keys(detail.old_values).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Before</p>
                  <pre className="bg-slate-800 rounded-md p-3 text-slate-300 text-xs overflow-auto">
                    {JSON.stringify(detail.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {detail.new_values && Object.keys(detail.new_values).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">After</p>
                  <pre className="bg-slate-800 rounded-md p-3 text-emerald-400 text-xs overflow-auto">
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
