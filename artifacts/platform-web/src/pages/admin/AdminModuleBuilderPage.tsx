import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DynamicIcon, AVAILABLE_ICONS } from "@/components/modules/DynamicIcon";
import {
  createModule, updateModule, fetchAdminModule,
  createField, updateField, deleteField, reorderFields,
  type DynamicModule, type ModuleField, type FieldType,
} from "@/lib/moduleApi";
import {
  ArrowLeft, GripVertical, Plus, Pencil, Trash2,
  Loader2, Check, ChevronRight, ChevronLeft, Box,
} from "lucide-react";

// ── Field type options ────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",          label: "Text" },
  { value: "long_text",     label: "Long Text" },
  { value: "number",        label: "Number" },
  { value: "decimal",       label: "Decimal" },
  { value: "currency",      label: "Currency" },
  { value: "date",          label: "Date" },
  { value: "datetime",      label: "Date & Time" },
  { value: "boolean",       label: "Boolean (Yes/No)" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select",  label: "Multi Select" },
  { value: "user_picker",   label: "User Picker" },
];

// ── Sortable field row ────────────────────────────────────────────────────────

function SortableFieldRow({
  field,
  onEdit,
  onDelete,
}: {
  field: ModuleField;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          {field.is_required && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0">Required</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">{field.name}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground capitalize">{field.field_type.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Field editor dialog ───────────────────────────────────────────────────────

interface FieldDialogProps {
  open: boolean;
  initial?: ModuleField;
  onClose: () => void;
  onSave: (data: Partial<ModuleField>) => Promise<void>;
}

function FieldDialog({ open, initial, onClose, onSave }: FieldDialogProps) {
  const [name, setName]           = useState(initial?.name ?? "");
  const [label, setLabel]         = useState(initial?.label ?? "");
  const [type, setType]           = useState<FieldType>(initial?.field_type ?? "text");
  const [required, setRequired]   = useState(initial?.is_required ?? false);
  const [inList, setInList]       = useState(initial?.show_in_list ?? true);
  const [inForm, setInForm]       = useState(initial?.show_in_form ?? true);
  const [choices, setChoices]     = useState<string>(
    (initial?.options?.choices ?? []).join("\n"),
  );
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setLabel(initial?.label ?? "");
      setType(initial?.field_type ?? "text");
      setRequired(initial?.is_required ?? false);
      setInList(initial?.show_in_list ?? true);
      setInForm(initial?.show_in_form ?? true);
      setChoices((initial?.options?.choices ?? []).join("\n"));
    }
  }, [open, initial]);

  const needsChoices = type === "single_select" || type === "multi_select";

  const autoName = (lbl: string) =>
    lbl.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const opts: ModuleField["options"] = needsChoices
      ? { choices: choices.split("\n").map((s) => s.trim()).filter(Boolean) }
      : null;
    try {
      await onSave({
        name:         name || autoName(label),
        label,
        field_type:   type,
        is_required:  required,
        show_in_list: inList,
        show_in_form: inForm,
        options:      opts,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Field" : "Add Field"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Label <span className="text-destructive">*</span></Label>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!initial) setName(autoName(e.target.value));
              }}
              placeholder="e.g. First Name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Field Name (machine-readable)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/g, "").toLowerCase())}
              placeholder="first_name"
              disabled={!!initial}
              className="font-mono text-xs"
            />
            {!!initial && (
              <p className="text-[10px] text-muted-foreground">Field name cannot be changed after creation.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsChoices && (
            <div className="space-y-1.5">
              <Label className="text-xs">Choices (one per line)</Label>
              <Textarea
                value={choices}
                onChange={(e) => setChoices(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
                rows={4}
                className="text-sm font-mono"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center justify-between">
              <span className="text-sm">Required</span>
              <Switch checked={required} onCheckedChange={setRequired} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show in List</span>
              <Switch checked={inList} onCheckedChange={setInList} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show in Form</span>
              <Switch checked={inForm} onCheckedChange={setInForm} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !label.trim()} className="gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Icon picker ───────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 max-h-36 overflow-y-auto p-1">
      {AVAILABLE_ICONS.map((name) => (
        <button
          key={name}
          type="button"
          title={name}
          onClick={() => onChange(name)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            value === name
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <DynamicIcon name={name} className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < step
                ? "bg-primary text-primary-foreground"
                : i === step
                ? "bg-primary/20 text-primary border border-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 ${i < step ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Builder page ─────────────────────────────────────────────────────────

export default function AdminModuleBuilderPage() {
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc        = useQueryClient();
  const isEdit    = !!id;

  const [step, setStep] = useState(0);

  // Step 1 — Module info
  const [name, setName]           = useState("");
  const [slug, setSlug]           = useState("");
  const [icon, setIcon]           = useState("Box");
  const [description, setDesc]    = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  // Step 2 — Fields
  const [savedModule, setSavedModule] = useState<DynamicModule | null>(null);
  const [fields, setFields]           = useState<ModuleField[]>([]);
  const [fieldDialog, setFieldDialog] = useState(false);
  const [editingField, setEditingField] = useState<ModuleField | undefined>();

  // Load existing module for edit mode
  const { isLoading: loadingModule } = useQuery({
    queryKey: ["admin", "module", id],
    queryFn: async () => {
      const res = await fetchAdminModule(Number(id));
      const m   = res.data;
      setName(m.name);
      setSlug(m.slug);
      setIcon(m.icon);
      setDesc(m.description ?? "");
      setIsEnabled(m.is_enabled);
      setSavedModule(m);
      setFields(m.fields ?? []);
      return m;
    },
    enabled: isEdit,
  });

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);

    if (savedModule) {
      try {
        await reorderFields(savedModule.id, reordered.map((f) => f.id));
      } catch {
        // revert on error
        setFields(fields);
        toast({ title: "Reorder failed", variant: "destructive" });
      }
    }
  };

  // Step 1 save — create/update module
  const saveModuleMutation = useMutation({
    mutationFn: async () => {
      if (savedModule) {
        const res = await updateModule(savedModule.id, { name, icon, description, is_enabled: isEnabled });
        return res.data;
      } else {
        const res = await createModule({ name, slug: slug || undefined, icon, description, is_enabled: isEnabled });
        return res.data;
      }
    },
    onSuccess: (module) => {
      setSavedModule(module);
      if (!isEdit) setSlug(module.slug);
      qc.invalidateQueries({ queryKey: ["admin", "modules"] });
      setStep(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSaveField = async (data: Partial<ModuleField>) => {
    if (!savedModule) return;
    if (editingField) {
      const res = await updateField(savedModule.id, editingField.id, data);
      setFields((prev) => prev.map((f) => (f.id === editingField.id ? res.data : f)));
    } else {
      const res = await createField(savedModule.id, data as Omit<ModuleField, "id" | "module_id" | "created_at">);
      setFields((prev) => [...prev, res.data]);
    }
    qc.invalidateQueries({ queryKey: ["admin", "module", String(savedModule.id)] });
    setEditingField(undefined);
  };

  const handleDeleteField = async (field: ModuleField) => {
    if (!savedModule) return;
    await deleteField(savedModule.id, field.id);
    setFields((prev) => prev.filter((f) => f.id !== field.id));
    qc.invalidateQueries({ queryKey: ["admin", "module", String(savedModule.id)] });
    toast({ title: "Field deleted" });
  };

  if (isEdit && loadingModule) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3">
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

  return (
    <div className="p-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-4" onClick={() => navigate("/admin/modules")}>
        <ArrowLeft className="w-3.5 h-3.5" />
        All Modules
      </Button>

      <h1 className="text-xl font-bold text-foreground mb-1">
        {isEdit ? "Edit Module" : "New Module"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isEdit ? "Update module configuration and fields." : "Build a no-code data module in two steps."}
      </p>

      {!isEdit && <StepIndicator step={step} total={2} />}

      {/* ── Step 0: Module info ─────────────────────────────────────────────── */}
      {(step === 0 || isEdit) && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          {!isEdit && <h2 className="font-semibold text-sm text-foreground">Module Details</h2>}

          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!savedModule) {
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }
              }}
              placeholder="e.g. CRM Contacts"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">Slug (URL identifier)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, "").toLowerCase())}
                placeholder="crm-contacts"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Used in URLs: /m/{slug || "your-module"}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Icon</Label>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <DynamicIcon name={icon} className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Selected: {icon}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-2">
              <IconPicker value={icon} onChange={setIcon} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What is this module for?"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Active</Label>
              <p className="text-[10px] text-muted-foreground">Visible to tenant users</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {isEdit ? (
              <>
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="gap-2"
                  disabled={saveModuleMutation.isPending}
                >
                  Manage Fields
                </Button>
                <Button
                  onClick={() => saveModuleMutation.mutate()}
                  disabled={!name.trim() || saveModuleMutation.isPending}
                  className="gap-2"
                >
                  {saveModuleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() => saveModuleMutation.mutate()}
                disabled={!name.trim() || saveModuleMutation.isPending}
                className="gap-2"
              >
                {saveModuleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 1: Fields ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-foreground">Fields</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder. Fields marked "Show in List" appear as table columns.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => { setEditingField(undefined); setFieldDialog(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Field
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Box className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No fields yet. Add your first field.</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => { setEditingField(undefined); setFieldDialog(true); }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Field
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      onEdit={() => { setEditingField(field); setFieldDialog(true); }}
                      onDelete={() => handleDeleteField(field)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            {!isEdit && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep(0)}>
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            )}
            <Button
              onClick={() => {
                toast({ title: isEdit ? "Module saved!" : "Module created!" });
                qc.invalidateQueries({ queryKey: ["admin", "modules"] });
                navigate("/admin/modules");
              }}
              className="gap-2 ml-auto"
            >
              <Check className="w-3.5 h-3.5" />
              {isEdit ? "Done" : "Finish"}
            </Button>
          </div>
        </div>
      )}

      <FieldDialog
        open={fieldDialog}
        initial={editingField}
        onClose={() => { setFieldDialog(false); setEditingField(undefined); }}
        onSave={handleSaveField}
      />
    </div>
  );
}
