import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, X } from "lucide-react";
import { ModuleFieldInput } from "./ModuleFieldInput";
import { createRecord, updateRecord, type DynamicModule, type DynamicRecord } from "@/lib/moduleApi";

interface Props {
  module: DynamicModule;
  record?: DynamicRecord;
  onSuccess?: () => void;
}

export function ModuleRecordForm({ module, record, onSuccess }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const formFields = module.fields?.filter((f) => f.show_in_form) ?? [];

  const [data, setData] = useState<Record<string, unknown>>(() => {
    if (record) return { ...(record.data ?? {}) };
    return {};
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mutation = useMutation({
    mutationFn: () =>
      record
        ? updateRecord(module.slug, record.id, data)
        : createRecord(module.slug, data),
    onSuccess: () => {
      toast({ title: record ? "Record updated" : "Record created" });
      qc.invalidateQueries({ queryKey: ["module-records", module.slug] });
      qc.invalidateQueries({ queryKey: ["module-stats", module.slug] });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/m/${module.slug}`);
      }
    },
    onError: (err: { data?: { errors?: Record<string, string[]> }; message?: string }) => {
      if (err?.data?.errors) {
        setFieldErrors(err.data.errors);
      } else {
        toast({
          title: "Error",
          description: (err as Error).message ?? "Failed to save record",
          variant: "destructive",
        });
      }
    },
  });

  const setField = (name: string, value: unknown) => {
    setData((d) => ({ ...d, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((e) => {
        const next = { ...e };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFieldErrors({});
        mutation.mutate();
      }}
      className="space-y-6"
    >
      {formFields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No fields configured for this module.
        </p>
      )}

      {formFields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label htmlFor={`field-${field.name}`} className="text-sm font-medium">
            {field.label}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <ModuleFieldInput
            field={field}
            value={data[field.name] ?? (field.field_type === "boolean" ? false : field.field_type === "multi_select" ? [] : "")}
            onChange={(v) => setField(field.name, v)}
            disabled={mutation.isPending}
          />
          {fieldErrors[field.name]?.map((e) => (
            <p key={e} className="text-xs text-destructive">{e}</p>
          ))}
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={mutation.isPending} className="gap-2">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {record ? "Save Changes" : "Create Record"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(`/m/${module.slug}`)}
          disabled={mutation.isPending}
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
