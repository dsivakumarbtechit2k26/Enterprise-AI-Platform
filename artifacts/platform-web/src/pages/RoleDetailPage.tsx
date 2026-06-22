import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetRole,
  useListPermissions,
  useUpdateRole,
  useDeleteRole,
  getGetRoleQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, Save, Trash2, Search, Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchTeamMembers, type TeamMember } from "@/lib/moduleApi";
import { useAuthStore } from "@/stores/authStore";

// ── API helpers ───────────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const { token, activeTenantId } = useAuthStore.getState();
  const h: Record<string, string> = {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (activeTenantId) h["X-Tenant-ID"] = activeTenantId;
  return h;
}

async function fetchRoleUsers(roleId: number): Promise<{ data: TeamMember[] }> {
  const res = await fetch(`/api/v1/roles/${roleId}/users`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load role members.");
  return res.json();
}

async function assignUserToRole(roleId: number, userId: number): Promise<void> {
  const res = await fetch(`/api/v1/roles/${roleId}/assign`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "Failed to assign user.");
  }
}

async function removeUserFromRole(roleId: number, userId: number): Promise<void> {
  const res = await fetch(`/api/v1/roles/${roleId}/remove`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "Failed to remove user.");
  }
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

// ── Members section ───────────────────────────────────────────────────────────

function MembersSection({ roleId, isSystem }: { roleId: number; isSystem: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["role-users", roleId],
    queryFn: () => fetchRoleUsers(roleId),
    staleTime: 30_000,
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ["team-members-for-picker"],
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  });

  const currentMembers = membersData?.data ?? [];
  const allTeamMembers = teamData?.data ?? [];
  const currentMemberIds = new Set(currentMembers.map((m) => m.id));
  const assignable = allTeamMembers.filter((m) => !currentMemberIds.has(m.id));

  const assignMutation = useMutation({
    mutationFn: (userId: number) => assignUserToRole(roleId, userId),
    onSuccess: () => {
      toast({ title: "User assigned to role" });
      setSelectedUserId("");
      qc.invalidateQueries({ queryKey: ["role-users", roleId] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeUserFromRole(roleId, userId),
    onSuccess: () => {
      toast({ title: "User removed from role" });
      qc.invalidateQueries({ queryKey: ["role-users", roleId] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Members
            <Badge variant="secondary" className="text-xs font-mono">{currentMembers.length}</Badge>
          </CardTitle>

          {!isSystem && (
            <PermissionGate permission="roles.assign">
              <div className="flex items-center gap-2">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={teamLoading || assignable.length === 0}
                >
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder={assignable.length === 0 ? "All users assigned" : "Add member…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(m.name || m.email)}
                          </span>
                          {m.name || m.email}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={!selectedUserId || assignMutation.isPending}
                  onClick={() => selectedUserId && assignMutation.mutate(Number(selectedUserId))}
                >
                  {assignMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <UserPlus className="w-3.5 h-3.5" />}
                  Add
                </Button>
              </div>
            </PermissionGate>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {membersLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : currentMembers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No members assigned to this role yet.</p>
            {isSystem && <p className="text-xs mt-1 text-muted-foreground/70">System roles are assigned automatically.</p>}
          </div>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {currentMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                      {getInitials(member.name || member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">{member.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                  </div>
                </div>
                {!isSystem && (
                  <PermissionGate permission="roles.assign">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(member.id)}
                      title="Remove from role"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  </PermissionGate>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: role, isLoading: roleLoading, refetch: refetchRole } = useGetRole(Number(roleId), {
    query: { enabled: !!roleId, queryKey: getGetRoleQueryKey(Number(roleId)) },
  });

  const { data: permissionsData, isLoading: permsLoading } = useListPermissions();
  const allPermissions = permissionsData?.data || [];

  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  if (role && !hasInitialized && role.permissions) {
    setSelectedPermIds(new Set(role.permissions.map((p) => p.id)));
    setHasInitialized(true);
  }

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof allPermissions> = {};
    const filtered = allPermissions.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.display_name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    filtered.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  }, [allPermissions, searchTerm]);

  const handleTogglePermission = (permId: number) => {
    if (role?.is_system) return;
    const next = new Set(selectedPermIds);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);
    setSelectedPermIds(next);
  };

  const handleSave = () => {
    if (!roleId || role?.is_system) return;
    updateRoleMutation.mutate(
      { roleId: Number(roleId), data: { permission_ids: Array.from(selectedPermIds) } },
      {
        onSuccess: () => { toast({ title: "Role updated successfully" }); refetchRole(); },
        onError: (err) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    if (!roleId || role?.is_system) return;
    deleteRoleMutation.mutate(
      { roleId: Number(roleId) },
      {
        onSuccess: () => { toast({ title: "Role deleted" }); navigate("/roles"); },
        onError: (err) => toast({ title: "Failed to delete role", description: err.message, variant: "destructive" }),
      },
    );
  };

  if (roleLoading || permsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Role not found</h2>
        <Button variant="link" asChild className="mt-4"><Link to="/roles">Back to Roles</Link></Button>
      </div>
    );
  }

  const isDirty =
    role.permissions
      ? selectedPermIds.size !== role.permissions.length ||
        !role.permissions.every((p) => selectedPermIds.has(p.id))
      : false;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">

      {/* Back link */}
      <Link to="/roles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Roles
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{role.display_name}</h1>
            {role.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
          </div>
          <p className="text-muted-foreground mt-0.5 font-mono text-xs">{role.name}</p>
          {role.description && (
            <p className="text-sm text-muted-foreground mt-1.5">{role.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!role.is_system && (
            <PermissionGate permission="roles.delete">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{role.display_name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the role and remove it from all assigned users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Role
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          )}

          <PermissionGate permission="roles.update">
            <Button
              onClick={handleSave}
              disabled={role.is_system || !isDirty || updateRoleMutation.isPending}
              size="sm"
            >
              {updateRoleMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <Save className="w-4 h-4 mr-1.5" /> Save Changes
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* System role warning */}
      {role.is_system && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">System Role</p>
            <p className="text-muted-foreground mt-0.5">
              This is a built-in system role. Its permissions are managed by the platform and cannot be modified.
            </p>
          </div>
        </div>
      )}

      {/* Members */}
      <MembersSection roleId={Number(roleId)} isSystem={!!role.is_system} />

      {/* Permissions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">Permissions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {role.is_system
                ? "Read-only — system role permissions cannot be changed."
                : "Toggle which actions this role can perform."}
            </p>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter permissions…"
              className="pl-9 h-8 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedPermissions).map(([group, perms]) => (
            <Card key={group} className="overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.replace(/_/g, " ")}
                </h3>
                <Badge variant="outline" className="text-[10px]">{perms.length}</Badge>
              </div>
              <div className="divide-y">
                {perms.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="space-y-0.5 pr-6 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">{perm.display_name}</p>
                      {perm.description && (
                        <p className="text-xs text-muted-foreground mt-1">{perm.description}</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{perm.name}</p>
                    </div>
                    <Switch
                      checked={selectedPermIds.has(perm.id)}
                      onCheckedChange={() => handleTogglePermission(perm.id)}
                      disabled={role.is_system}
                      aria-label={`Toggle ${perm.display_name}`}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {Object.keys(groupedPermissions).length === 0 && (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              No permissions match "{searchTerm}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
