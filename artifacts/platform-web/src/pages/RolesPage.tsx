import { useState } from "react";
import { Link } from "react-router-dom";
import { useListRoles, useCreateRole } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Search, Plus, MoreHorizontal, ArrowRight, Loader2, Key } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";

export default function RolesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDisplayName, setNewRoleDisplayName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  
  const { toast } = useToast();
  const { data: rolesData, isLoading, refetch } = useListRoles();
  const createRoleMutation = useCreateRole();

  const roles = rolesData?.data || [];
  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateRole = () => {
    if (!newRoleName || !newRoleDisplayName) return;

    createRoleMutation.mutate({
      data: {
        name: newRoleName,
        display_name: newRoleDisplayName,
        description: newRoleDesc,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Role created successfully" });
        setIsCreateOpen(false);
        setNewRoleName("");
        setNewRoleDisplayName("");
        setNewRoleDesc("");
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Failed to create role",
          description: err.message,
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground mt-1">
            Manage roles and their permissions for your organization.
          </p>
        </div>
        
        <PermissionGate permission="roles.create">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Role</DialogTitle>
                <DialogDescription>
                  Create a new role to assign specific permissions to users.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input 
                    placeholder="e.g. Marketing Manager" 
                    value={newRoleDisplayName}
                    onChange={(e) => {
                      setNewRoleDisplayName(e.target.value);
                      if (!newRoleName) {
                        setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>System Name (Identifier)</Label>
                  <Input 
                    placeholder="e.g. marketing_manager" 
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier used in the system.</p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    placeholder="Optional description" 
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRole} disabled={createRoleMutation.isPending || !newRoleName || !newRoleDisplayName}>
                  {createRoleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search roles..." 
          className="pl-9 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader>
              <CardContent><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoles.map(role => (
            <Card key={role.id} className="flex flex-col hover-elevate transition-all">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.display_name}
                      {role.is_system && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1 font-mono text-xs">{role.name}</CardDescription>
                  </div>
                  <div className="bg-muted p-2 rounded-md">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 min-h-[40px]">
                  {role.description || "No description provided."}
                </p>
              </CardHeader>
              <CardContent className="pb-3 flex-1">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Key className="w-4 h-4" />
                    <span>{role.permissions?.length || 0} permissions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{role.users_count || 0} users</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="secondary" className="w-full justify-between" asChild>
                  <Link to={`/roles/${role.id}`}>
                    Manage Role <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {filteredRoles.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              No roles found matching "{searchTerm}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
