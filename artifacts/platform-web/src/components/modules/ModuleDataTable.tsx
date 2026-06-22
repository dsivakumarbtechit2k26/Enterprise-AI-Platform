import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2,
  ChevronLeft, ChevronRight, TrendingUp, Calendar,
  ChevronUp, ChevronDown, ChevronsUpDown, Download,
  Filter, X,
} from "lucide-react";
import {
  fetchRecords, fetchModuleStats, deleteRecord, bulkDeleteRecords, buildExportUrl,
  type DynamicModule, type DynamicRecord, type ModuleField,
} from "@/lib/moduleApi";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  module: DynamicModule;
}

// ── Cell renderer ──────────────────────────────────────────────────────────────

function CellValue({ value, fieldType }: { value: unknown; fieldType: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  switch (fieldType) {
    case "boolean":
      return <Badge variant={Boolean(value) ? "default" : "secondary"} className="text-xs">{Boolean(value) ? "Yes" : "No"}</Badge>;
    case "date":
      return <span>{new Date(value as string).toLocaleDateString()}</span>;
    case "datetime":
      return <span>{new Date(value as string).toLocaleString()}</span>;
    case "currency":
      return <span>${Number(value).toFixed(2)}</span>;
    case "single_select":
      return <Badge variant="outline" className="text-xs">{String(value)}</Badge>;
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [String(value)];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((v) => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
        </div>
      );
    }
    case "long_text": {
      const str = String(value);
      return <span className="truncate max-w-[200px] block" title={str}>{str}</span>;
    }
    default:
      return <span className="truncate max-w-[200px] block">{String(value)}</span>;
  }
}

// ── Sort indicator icon ────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: "asc" | "desc" }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 text-muted-foreground/40 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-primary inline" />
    : <ChevronDown className="w-3 h-3 ml-1 text-primary inline" />;
}

// ── KPI Panel ─────────────────────────────────────────────────────────────────

function KpiPanel({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ["module-stats", slug],
    queryFn: () => fetchModuleStats(slug),
    staleTime: 30_000,
  });
  const stats = data?.data;

  return (
    <div className="w-64 shrink-0 rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overview</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Records</p>
              {stats ? (
                <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
              ) : (
                <Skeleton className="h-7 w-12 mt-0.5" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">This Week</p>
              {stats ? (
                <p className="text-2xl font-bold text-foreground">{stats.this_week.toLocaleString()}</p>
              ) : (
                <Skeleton className="h-7 w-12 mt-0.5" />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Last 7 Days</p>
        {stats ? (
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={stats.daily_chart} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <RechartTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--popover-foreground))" }}
                formatter={(v: number) => [v, "Records"]}
                labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Skeleton className="h-[110px] w-full" />
        )}
      </div>
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function ModuleDataTable({ module }: Props) {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const qc        = useQueryClient();
  const { token, activeTenantId } = useAuthStore();

  // ── Query state ──────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [filters,   setFilters]   = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selected,  setSelected]  = useState<Set<number>>(new Set());
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const listFields = useMemo(
    () => module.fields?.filter((f) => f.show_in_list) ?? [],
    [module.fields],
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["module-records", module.slug, page, search, sortField, sortDir, filters],
    queryFn: () => fetchRecords(module.slug, { page, search, per_page: 20, sort_field: sortField, sort_dir: sortDir, filters }),
    placeholderData: (prev) => prev,
  });

  const records = data?.data ?? [];
  const meta    = data?.meta;

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const handleSort = useCallback((fieldName: string) => {
    setPage(1);
    setSelected(new Set());
    if (sortField === fieldName) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldName);
      setSortDir("asc");
    }
  }, [sortField]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  const setFilter = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
    setSelected(new Set());
  };
  const clearFilters = () => {
    setFilters({});
    setPage(1);
    setSelected(new Set());
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allVisible = records.map((r) => r.id);
  const allSelected = allVisible.length > 0 && allVisible.every((id) => selected.has(id));
  const someSelected = allVisible.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); allVisible.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((s) => new Set([...s, ...allVisible]));
    }
  };
  const toggleRow = (id: number) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["module-records", module.slug] });
    qc.invalidateQueries({ queryKey: ["module-stats", module.slug] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRecord(module.slug, id),
    onSuccess: () => {
      toast({ title: "Record deleted" });
      invalidate();
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteRecords(module.slug, ids),
    onSuccess: (res) => {
      toast({ title: `Deleted ${res.deleted} record${res.deleted !== 1 ? "s" : ""}` });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const url = buildExportUrl(module.slug, { search, sort_field: sortField, sort_dir: sortDir, filters });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token ?? ""}`,
      Accept: "text/csv",
    };
    if (activeTenantId) headers["X-Tenant-ID"] = activeTenantId;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${module.slug}-records.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const selectedCount = selected.size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex gap-6 mt-4 items-start">
        {/* ── Table column ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Search */}
              <div className="relative flex items-center max-w-xs w-full">
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search records…"
                  className="pl-8 h-8 text-sm bg-muted/40"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }}
                />
              </div>

              {/* Filter toggle */}
              <Button
                variant={showFilters || hasActiveFilters ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 shrink-0"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="default" className="ml-1 h-4 px-1 text-[10px]">
                    {Object.values(filters).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Bulk delete when rows are selected */}
              {selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedCount}
                </Button>
              )}

              {/* CSV Export */}
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>

              {/* New Record */}
              <Button asChild size="sm" className="gap-1.5 h-8">
                <Link to={`/m/${module.slug}/new`}>
                  <Plus className="w-3.5 h-3.5" />
                  New Record
                </Link>
              </Button>
            </div>
          </div>

          {/* Filter row */}
          {showFilters && listFields.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Field Filters</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={clearFilters}>
                    <X className="w-3 h-3" />
                    Clear all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {listFields.map((f: ModuleField) => (
                  <div key={f.id} className="flex flex-col gap-1 min-w-[140px] max-w-[200px]">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</label>
                    <Input
                      placeholder={`Filter ${f.label}…`}
                      className="h-7 text-xs bg-background"
                      value={filters[f.name] ?? ""}
                      onChange={(e) => setFilter(f.name, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    {/* Bulk-select checkbox */}
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                        className="border-muted-foreground/30"
                      />
                    </TableHead>
                    <TableHead className="w-12 text-muted-foreground text-xs">#</TableHead>

                    {/* Sortable field columns */}
                    {listFields.map((f: ModuleField) => (
                      <TableHead
                        key={f.id}
                        className="text-muted-foreground text-xs cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort(f.name)}
                      >
                        {f.label}
                        <SortIcon field={f.name} sortField={sortField} sortDir={sortDir} />
                      </TableHead>
                    ))}

                    {/* Sortable created_at column */}
                    <TableHead
                      className="w-24 text-muted-foreground text-xs cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => handleSort("created_at")}
                    >
                      Created
                      <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: listFields.length + 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={listFields.length + 4} className="text-center py-16 text-muted-foreground text-sm">
                        {hasActiveFilters || search
                          ? "No records match the current filters."
                          : "No records found. Create your first one."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record: DynamicRecord) => {
                      const isSelected = selected.has(record.id);
                      return (
                        <TableRow
                          key={record.id}
                          className={`cursor-pointer hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                          onClick={() => navigate(`/m/${module.slug}/${record.id}`)}
                        >
                          {/* Row checkbox */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(record.id)}
                              aria-label={`Select record ${record.id}`}
                              className="border-muted-foreground/30"
                            />
                          </TableCell>

                          <TableCell className="text-muted-foreground text-xs font-mono">{record.id}</TableCell>

                          {listFields.map((f: ModuleField) => (
                            <TableCell key={f.id} className="text-sm">
                              <CellValue value={record.data?.[f.name]} fieldType={f.field_type} />
                            </TableCell>
                          ))}

                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(record.created_at).toLocaleDateString()}
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/m/${module.slug}/${record.id}/edit`)}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteId(record.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {meta.total === 0
                  ? "0 records"
                  : `${((page - 1) * meta.per_page) + 1}–${Math.min(page * meta.per_page, meta.total)} of ${meta.total.toLocaleString()} records`}
                {selectedCount > 0 && (
                  <span className="ml-2 text-primary font-medium">{selectedCount} selected</span>
                )}
              </p>
              {meta.last_page > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{page} / {meta.last_page}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── KPI panel ──────────────────────────────────────────────────── */}
        <KpiPanel slug={module.slug} />
      </div>

      {/* Single delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} record{selectedCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} selected record{selectedCount !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selected])}
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${selectedCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
