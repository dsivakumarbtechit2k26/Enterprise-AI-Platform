import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchRecord, deleteRecord } from "@/lib/moduleApi";
import { DynamicIcon } from "@/components/modules/DynamicIcon";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export default function ModuleRecordDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const qc           = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["module-record", slug, id],
    queryFn: () => fetchRecord(slug!, Number(id)),
    enabled: !!slug && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(slug!, Number(id)),
    onSuccess: () => {
      toast({ title: "Record deleted" });
      qc.invalidateQueries({ queryKey: ["module-records", slug] });
      qc.invalidateQueries({ queryKey: ["module-stats", slug] });
      navigate(`/m/${slug}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Record not found.</p>
      </div>
    );
  }

  const { data: record, module } = data;
  const fields = module.fields ?? [];

  function renderFieldValue(value: unknown, fieldType: string): React.ReactNode {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground/50">—</span>;
    }
    switch (fieldType) {
      case "boolean":
        return <Badge variant={Boolean(value) ? "default" : "secondary"}>{Boolean(value) ? "Yes" : "No"}</Badge>;
      case "date":
        return new Date(value as string).toLocaleDateString();
      case "datetime":
        return new Date(value as string).toLocaleString();
      case "currency":
        return `$${Number(value).toFixed(2)}`;
      case "single_select":
        return <Badge variant="outline">{String(value)}</Badge>;
      case "multi_select": {
        const arr = Array.isArray(value) ? (value as string[]) : [String(value)];
        return (
          <div className="flex flex-wrap gap-1">
            {arr.map((v) => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
          </div>
        );
      }
      default:
        return <span className="whitespace-pre-wrap">{String(value)}</span>;
    }
  }

  return (
    <>
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
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <DynamicIcon name={module.icon} className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">{module.name} #{record.id}</h1>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(record.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to={`/m/${module.slug}/${record.id}/edit`}>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {/* Fields */}
          <div className="bg-card rounded-xl border border-border">
            {fields.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No fields configured.
              </div>
            ) : (
              <dl className="divide-y divide-border">
                {fields.map((field) => (
                  <div key={field.id} className="flex gap-4 px-6 py-3.5">
                    <dt className="w-36 shrink-0 text-sm text-muted-foreground font-medium pt-0.5">
                      {field.label}
                    </dt>
                    <dd className="flex-1 text-sm text-foreground">
                      {renderFieldValue(record.data?.[field.name], field.field_type)}
                    </dd>
                  </div>
                ))}
                <div className="flex gap-4 px-6 py-3.5">
                  <dt className="w-36 shrink-0 text-sm text-muted-foreground font-medium pt-0.5">
                    Last Updated
                  </dt>
                  <dd className="text-sm text-foreground">
                    {new Date(record.updated_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Record #{record.id} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
