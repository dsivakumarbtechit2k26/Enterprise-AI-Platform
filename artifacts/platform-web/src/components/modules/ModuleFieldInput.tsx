import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModuleField } from "@/lib/moduleApi";

interface Props {
  field: ModuleField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

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
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.label}
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
      const choices = field.options?.choices ?? [];
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
                  if (e.target.checked) {
                    onChange([...selected, c]);
                  } else {
                    onChange(selected.filter((s) => s !== c));
                  }
                }}
              />
              <span className="text-sm">{c}</span>
            </label>
          ))}
        </div>
      );
    }

    case "user_picker":
    case "relation":
      return (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Enter ${field.label}…`}
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
