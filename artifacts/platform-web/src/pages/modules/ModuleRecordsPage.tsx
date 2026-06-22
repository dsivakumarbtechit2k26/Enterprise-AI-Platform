import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ModuleDataTable } from "@/components/modules/ModuleDataTable";
import { fetchModuleDetail } from "@/lib/moduleApi";
import { DynamicIcon } from "@/components/modules/DynamicIcon";
import { Plus } from "lucide-react";

export default function ModuleRecordsPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["module-detail", slug],
    queryFn: () => fetchModuleDetail(slug!),
    enabled: !!slug,
  });

  const module = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">Module not found or unavailable.</p>
        <Button variant="ghost" asChild className="mt-2">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DynamicIcon name={module.icon} className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{module.name}</h1>
            {module.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
            )}
          </div>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link to={`/m/${module.slug}/new`}>
            <Plus className="w-3.5 h-3.5" />
            New Record
          </Link>
        </Button>
      </div>

      <ModuleDataTable module={module} />
    </div>
  );
}
