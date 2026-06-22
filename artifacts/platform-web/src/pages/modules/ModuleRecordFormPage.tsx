import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ModuleRecordForm } from "@/components/modules/ModuleRecordForm";
import { fetchModuleDetail, fetchRecord } from "@/lib/moduleApi";
import { DynamicIcon } from "@/components/modules/DynamicIcon";
import { ArrowLeft } from "lucide-react";

interface Props {
  mode: "create" | "edit";
}

export default function ModuleRecordFormPage({ mode }: Props) {
  const { slug, id } = useParams<{ slug: string; id: string }>();

  const moduleQuery = useQuery({
    queryKey: ["module-detail", slug],
    queryFn: () => fetchModuleDetail(slug!),
    enabled: !!slug,
  });

  const recordQuery = useQuery({
    queryKey: ["module-record", slug, id],
    queryFn: () => fetchRecord(slug!, Number(id)),
    enabled: mode === "edit" && !!slug && !!id,
  });

  const module = moduleQuery.data?.data;
  const record = recordQuery.data?.data;

  if (moduleQuery.isLoading || (mode === "edit" && recordQuery.isLoading)) {
    return (
      <div className="flex-1 p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Module not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
            <Link to={`/m/${module.slug}`}>
              <ArrowLeft className="w-3.5 h-3.5" />
              {module.name}
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <DynamicIcon name={module.icon} className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {mode === "create" ? `New ${module.name}` : `Edit ${module.name}`}
            </h1>
            {mode === "edit" && record && (
              <p className="text-xs text-muted-foreground">Record #{record.id}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-6">
          <ModuleRecordForm module={module} record={mode === "edit" ? record : undefined} />
        </div>
      </div>
    </div>
  );
}
