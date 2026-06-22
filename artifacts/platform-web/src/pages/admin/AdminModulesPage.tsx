import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon } from "@/components/modules/DynamicIcon";
import {
  fetchAdminModules, toggleModule, deleteModule, type DynamicModule,
} from "@/lib/moduleApi";
import { adminFetch } from "@/lib/adminApi";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2,
  Layers, Eye,
} from "lucide-react";

// Use adminFetch for admin routes since they need the admin auth pattern
async function fetchModulesAdmin() {
  const res = await fetchAdminModules();
  return res.data;
}

export default function AdminModulesPage() {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const qc        = useQueryClient();

  const [search, setSearch]         = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DynamicModule | null>(null);

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["admin", "modules"],
    queryFn: fetchModulesAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleModule(id),
    onSuccess: (res) => {
      toast({ title: res.data.is_enabled ? "Module enabled" : "Module disabled" });
      qc.invalidateQueries({ queryKey: ["admin", "modules"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteModule(id),
    onSuccess: () => {
      toast({ title: "Module deleted" });
      qc.invalidateQueries({ queryKey: ["admin", "modules"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Module Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create and manage no-code application modules.
            </p>
          </div>
          <Button asChild className="gap-2 shrink-0">
            <Link to="/admin/modules/new">
              <Plus className="w-4 h-4" />
              New Module
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search modules…"
            className="pl-8 h-8 text-sm bg-muted/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Modules grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-10 w-10 rounded-lg mb-3" />
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-3 w-48 mb-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No modules yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Build your first no-code module to get started.
            </p>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/admin/modules/new">
                <Plus className="w-3.5 h-3.5" />
                Create Module
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((module) => (
              <div
                key={module.id}
                className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DynamicIcon name={module.icon} className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={module.is_enabled}
                      onCheckedChange={() => toggleMutation.mutate(module.id)}
                      disabled={toggleMutation.isPending}
                      className="data-[state=checked]:bg-primary"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/modules/${module.id}/edit`)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/m/${module.slug}`, "_blank")}>
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(module)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <h3 className="font-semibold text-foreground text-sm mb-0.5">{module.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mb-2 opacity-70">{module.slug}</p>
                {module.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{module.description}</p>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant={module.is_enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {module.is_enabled ? "Active" : "Disabled"}
                  </Badge>
                  {typeof module.records_count === "number" && (
                    <span className="text-[10px] text-muted-foreground">
                      {module.records_count.toLocaleString()} records
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => navigate(`/admin/modules/${module.id}/edit`)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the module and all its records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete Module
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
