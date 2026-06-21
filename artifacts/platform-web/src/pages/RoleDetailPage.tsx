import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, Save, Trash2, Shield, Search } from "lucide-react";
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

export default function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Queries
  const { data: role, isLoading: roleLoading, refetch: refetchRole } = useGetRole(Number(roleId), {
    query: { enabled: !!roleId, queryKey: getGetRoleQueryKey(Number(roleId)) }
  });
  
  const { data: permissionsData, isLoading: permsLoading } = useListPermissions();
  const allPermissions = permissionsData?.data || [];
  
  // Mutations
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  // Local state for role edits
  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize selected perms when role loads
  if (role && !hasInitialized && role.permissions) {
    setSelectedPermIds(new Set(role.permissions.map(p => p.id)));
    setHasInitialized(true);
  }

  // Group permissions for display
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof allPermissions> = {};
    const filtered = allPermissions.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filtered.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    
    return groups;
  }, [allPermissions, searchTerm]);

  const handleTogglePermission = (permId: number) => {
    if (role?.is_system) return; // Cannot edit system roles
    
    const next = new Set(selectedPermIds);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);
    setSelectedPermIds(next);
  };

  const handleSave = () => {
    if (!roleId || role?.is_system) return;

    updateRoleMutation.mutate({
      roleId: Number(roleId),
      data: {
        permission_ids: Array.from(selectedPermIds)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Role updated successfully" });
        refetchRole();
      },
      onError: (err) => {
        toast({
          title: "Failed to update role",
          description: err.message,
          variant: "destructive"
        });
      }
    });
  };

  const handleDelete = () => {
    if (!roleId || role?.is_system) return;

    deleteRoleMutation.mutate({
      roleId: Number(roleId)
    }, {
      onSuccess: () => {
        toast({ title: "Role deleted successfully" });
        navigate("/roles");
      },
      onError: (err) => {
        toast({
          title: "Failed to delete role",
          description: err.message,
          variant: "destructive"
        });
      }
    });
  };

  if (roleLoading || permsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
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

  const isDirty = role.permissions ? selectedPermIds.size !== role.permissions.length || 
                  !role.permissions.every(p => selectedPermIds.has(p.id)) : false;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/roles" className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roles
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{role.display_name}</h1>
            {role.is_system && <Badge variant="secondary">System Role</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{role.name}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {!role.is_system && (
            <PermissionGate permission="roles.delete">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the 
                      <span className="font-semibold text-foreground"> {role.display_name} </span> 
                      role and remove it from all assigned users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Details</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Description</p>
            <p className="text-base">{role.description || "No description provided."}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Assigned Users</p>
            <p className="text-base">{role.users_count || 0} users have this role</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Permissions</h2>
            <p className="text-sm text-muted-foreground">Toggle which actions this role can perform.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter permissions..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {role.is_system && (
          <div className="bg-muted border rounded-md p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">System Role</p>
              <p className="text-muted-foreground">This is a built-in system role. Its permissions cannot be modified.</p>
            </div>
          </div>
        )}

        <div className="space-y-6 mt-6">
          {Object.entries(groupedPermissions).map(([group, perms]) => (
            <Card key={group} className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-medium capitalize">{group.replace(/_/g, ' ')}</h3>
                <Badge variant="outline">{perms.length}</Badge>
              </div>
              <div className="divide-y">
                {perms.map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="space-y-1 pr-6">
                      <p className="font-medium text-sm">{perm.display_name}</p>
                      {perm.description && (
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      )}
                    </div>
                    <Switch 
                      checked={selectedPermIds.has(perm.id)}
                      onCheckedChange={() => handleTogglePermission(perm.id)}
                      disabled={role.is_system}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}
          
          {Object.keys(groupedPermissions).length === 0 && (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              No permissions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
