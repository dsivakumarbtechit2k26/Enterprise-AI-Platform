import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminFetch, type AdminUser, type PaginatedResponse } from "@/lib/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronLeft, ChevronRight, KeyRound, CheckCircle } from "lucide-react";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [resetUserId, setResetUserId]   = useState<number | null>(null);
  const [resetUserName, setResetUserName] = useState("");
  const { toast } = useToast();

  const params = new URLSearchParams({
    page: String(page),
    per_page: "20",
    ...(search ? { search } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () => adminFetch<PaginatedResponse<AdminUser>>(`/users?${params}`),
    placeholderData: (prev) => prev,
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) =>
      adminFetch(`/users/${userId}/reset-password`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Password reset email sent" });
      setResetUserId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-slate-400 text-sm mt-1">
          {data?.meta.total ?? "…"} users across all tenants
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-8 bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Search</Button>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">User</TableHead>
              <TableHead className="text-slate-400">Tenants</TableHead>
              <TableHead className="text-slate-400">Roles</TableHead>
              <TableHead className="text-slate-400">Verified</TableHead>
              <TableHead className="text-slate-400">Joined</TableHead>
              <TableHead className="text-slate-400 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-white/10">
                    <TableCell><Skeleton className="h-4 w-40 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 bg-slate-800" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : data?.data.map((u) => (
                  <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.tenant_names.length === 0 ? (
                          <span className="text-slate-600 text-xs">—</span>
                        ) : (
                          u.tenant_names.slice(0, 3).map((name, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] border-white/10 text-slate-400 bg-white/5 px-1.5 py-0"
                            >
                              {name}
                            </Badge>
                          ))
                        )}
                        {u.tenant_names.length > 3 && (
                          <Badge variant="outline" className="text-[10px] border-white/10 text-slate-500 bg-white/5 px-1.5 py-0">
                            +{u.tenant_names.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.slice(0, 2).map((role, i) => (
                          <span key={i} className="text-xs text-slate-400 capitalize">{role}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.email_verified ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="text-xs text-amber-400">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-amber-400"
                        title="Send password reset"
                        onClick={() => { setResetUserId(u.id); setResetUserName(u.name); }}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
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
          <span>Page {data.meta.current_page} of {data.meta.last_page}</span>
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

      {/* Reset password confirmation */}
      <Dialog open={!!resetUserId} onOpenChange={(o) => !o && setResetUserId(null)}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Send Password Reset</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will send a password reset email to <strong className="text-white">{resetUserName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUserId(null)}>Cancel</Button>
            <Button
              onClick={() => resetUserId && resetMutation.mutate(resetUserId)}
              disabled={resetMutation.isPending}
            >
              Send Reset Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
