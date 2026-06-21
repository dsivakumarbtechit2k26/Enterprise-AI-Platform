import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminFetch, type AdminTenant, type PaginatedResponse } from "@/lib/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  trialing:  "bg-amber-400/10  text-amber-400  border-amber-400/20",
  suspended: "bg-red-400/10    text-red-400    border-red-400/20",
};

export default function AdminTenantsPage() {
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("all");
  const [plan,   setPlan]     = useState("all");
  const [page,   setPage]     = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    per_page: "20",
    ...(search  ? { search }        : {}),
    ...(status !== "all" ? { status } : {}),
    ...(plan   !== "all" ? { plan }   : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tenants", search, status, plan, page],
    queryFn: () => adminFetch<PaginatedResponse<AdminTenant>>(`/tenants?${params}`),
    placeholderData: (prev) => prev,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-slate-400 text-sm mt-1">
          {data?.meta.total ?? "…"} tenants total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
              className="pl-8 bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
        </form>

        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36 bg-slate-800 border-white/10 text-slate-300">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-slate-800 border-white/10 text-slate-300">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="professional_monthly">Pro Monthly</SelectItem>
              <SelectItem value="professional_yearly">Pro Yearly</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">Tenant</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Plan</TableHead>
              <TableHead className="text-slate-400 text-right">Users</TableHead>
              <TableHead className="text-slate-400">Created</TableHead>
              <TableHead className="text-slate-400 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-white/10">
                    <TableCell><Skeleton className="h-4 w-40 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10 bg-slate-800 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 bg-slate-800" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : data?.data.map((t) => (
                  <TableRow key={t.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-300 text-sm">{t.plan}</span>
                    </TableCell>
                    <TableCell className="text-right text-slate-300 text-sm">{t.user_count}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" asChild>
                        <Link to={`/admin/tenants/${t.id}`}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.total} total)
          </span>
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
  );
}
