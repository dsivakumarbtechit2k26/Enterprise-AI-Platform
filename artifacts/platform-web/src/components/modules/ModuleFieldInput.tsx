import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchRecords, type ModuleField } from "@/lib/moduleApi";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  field: ModuleField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

// ── Users fetcher (for user_picker) ───────────────────────────────────────────

async function fetchUserList(): Promise<{ data: { id: number; name: string; email: string }[] }> {
  const { token, activeTenantId } = useAuthStore.getState();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token ?? ""}`,
    Accept: "application/json",
  };
  if (activeTenantId) headers["X-Tenant-ID"] = activeTenantId;
  const res = await fetch("/api/v1/admin/users", { headers });
  if (!res.ok) return { data: [] };
  return res.json();
}

// ── User picker sub-component ─────────────────────────────────────────────────

function UserPickerInput({
  field, value, onChange, disabled,
}: { field: ModuleField; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["users-for-picker"],
    queryFn:  fetchUserList,
    staleTime: 60_000,
  });
  const users = data?.data ?? [];

  if (isLoading) return <Skeleton className="h-10 w-full" />;

  return (
    <Select
      value={value != null ? String(value) : ""}
      onValueChange={(v) => onChange(v ? Number(v) : null)}
      disabled={disabled}
    >
      <SelectTrigger id={`field-${field.name}`}>
        <SelectValue placeholder={`Select ${field.label}…`} />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.name || u.email}
          </SelectItem>
        ))}
        {users.length === 0 && (
          <div className="py-2 px-2 text-xs text-muted-foreground">No users found.</div>
        )}
      </SelectContent>
    </Select>
  );
}

// ── Relation picker sub-component ─────────────────────────────────────────────
// Fetches up to 100 records from the target module (field.options.module_slug)
// and stores the selected record's ID. Displays the first list-visible text
// field as the human-readable label, falling back to the record ID.

function RelationPickerInput({
  field, value, onChange, disabled,
}: { field: ModuleField; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const slug = field.options?.module_slug ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["relation-records", slug],
    queryFn:  () => fetchRecords(slug, { per_page: 100 }),
    staleTime: 60_000,
    enabled:  !!slug,
  });

  const records      = data?.data ?? [];
  const moduleFields = data?.module?.fields ?? [];
  // Use the first show_in_list text field as the display label
  const labelField   = moduleFields.find(
    (f) => f.show_in_list && ["text", "number", "decimal", "currency"].includes(f.field_type),
  );

  if (!slug) {
    return (
      <Input
        id={`field-${field.name}`}
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="No target module configured"
        className="text-muted-foreground"
      />
    );
  }

  if (isLoading) return <Skeleton className="h-10 w-full" />;

  return (
    <Select
      value={value != null ? String(value) : ""}
      onValueChange={(v) => onChange(v ? Number(v) : null)}
      disabled={disabled}
    >
      <SelectTrigger id={`field-${field.name}`}>
        <SelectValue placeholder={`Select ${field.label}…`} />
      </SelectTrigger>
      <SelectContent>
        {records.map((r) => {
          const label = labelField
            ? String(r.data[labelField.name] ?? r.id)
            : `#${r.id}`;
          return (
            <SelectItem key={r.id} value={String(r.id)}>
              {label}
            </SelectItem>
          );
        })}
        {records.length === 0 && (
          <div className="py-2 px-2 text-xs text-muted-foreground">
            No records in target module.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

// ── Main field input dispatcher ────────────────────────────────────────────────

export function ModuleFieldInput({ field, value, onChange, disabled }: Props) {
  const id = `field-${field.name}`;

  switch (field.field_type) {
    case "text":
      return (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.label}
        />
      );

    case "long_text":
      return (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.label}
          rows={3}
        />
      );

    case "number":
    case "decimal":
      return (
        <Input
          id={id}
          type="number"
          step={field.field_type === "decimal" ? "0.01" : "1"}
          min={field.options?.min !== undefined ? Number(field.options.min) : undefined}
          max={field.options?.max !== undefined ? Number(field.options.max) : undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.options?.min !== undefined || field.options?.max !== undefined
            ? `${field.options?.min ?? ""}–${field.options?.max ?? ""}`
            : field.label}
        />
      );

    case "currency": {
      const prefix = field.options?.prefix ?? "$";
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
            {prefix}
          </span>
          <Input
            id={id}
            type="number"
            step="0.01"
            min={field.options?.min !== undefined ? Number(field.options.min) : undefined}
            max={field.options?.max !== undefined ? Number(field.options.max) : undefined}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="pl-7"
            placeholder="0.00"
          />
        </div>
      );
    }

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "datetime":
      return (
        <Input
          id={id}
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <Label htmlFor={id} className="text-sm text-muted-foreground">
            {Boolean(value) ? "Yes" : "No"}
          </Label>
        </div>
      );

    case "single_select": {
      const choices = field.options?.choices ?? [];
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={`Select ${field.label}…`} />
          </SelectTrigger>
          <SelectContent>
            {choices.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "multi_select": {
      const choices  = field.options?.choices ?? [];
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border accent-primary"
                checked={selected.includes(c)}
                disabled={disabled}
                onChange={(e) => {
                  onChange(e.target.checked
                    ? [...selected, c]
                    : selected.filter((s) => s !== c));
                }}
              />
              <span className="text-sm">{c}</span>
            </label>
          ))}
        </div>
      );
    }

    case "user_picker":
      return (
        <UserPickerInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "relation":
      return (
        <RelationPickerInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );

    default:
      return (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}
