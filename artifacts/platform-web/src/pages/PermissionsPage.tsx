import { useState, useMemo } from "react";
import { useListPermissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shield, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PermissionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: permissionsData, isLoading } = useListPermissions();

  const permissions = permissionsData?.data || [];

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof permissions> = {};
    const filtered = permissions.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filtered.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    
    return groups;
  }, [permissions, searchTerm]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Reference list of all available system capabilities and access rights.
          </p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search permissions..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="bg-primary/20 p-2 rounded-full mt-0.5">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">How permissions work</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Permissions are the atomic building blocks of access control. They define specific actions 
              (like creating users or viewing billing data). You cannot assign permissions directly to users; 
              instead, you group them into <strong>Roles</strong>, and assign those roles to users.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)).map(([group, perms]) => (
            <div key={group} className="space-y-4">
              <h2 className="text-xl font-semibold capitalize flex items-center gap-2 border-b pb-2">
                <Shield className="w-5 h-5 text-muted-foreground" />
                {group.replace(/_/g, ' ')}
                <Badge variant="secondary" className="ml-2 font-normal">{perms.length}</Badge>
              </h2>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {perms.map(perm => (
                  <Card key={perm.id} className="shadow-sm">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-medium">{perm.display_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs font-mono text-muted-foreground bg-muted inline-block px-1.5 py-0.5 rounded mb-2">
                        {perm.name}
                      </p>
                      {perm.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {perm.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedPermissions).length === 0 && (
            <div className="py-20 text-center text-muted-foreground border border-dashed rounded-xl">
              No permissions found matching "{searchTerm}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
