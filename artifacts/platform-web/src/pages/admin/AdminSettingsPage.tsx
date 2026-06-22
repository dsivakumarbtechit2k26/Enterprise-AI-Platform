import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch, type AdminSetting } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, Mail, CheckCircle, XCircle, Loader2, Plus, Eye, EyeOff, Lock } from "lucide-react";

type SettingsData = Record<string, Record<string, AdminSetting>>;

const GROUP_LABELS: Record<string, string> = {
  general:  "General",
  auth:     "Authentication",
  mail:     "Email / SMTP",
  billing:  "Billing",
  features: "Feature Flags",
};

const SETTING_TYPES = ["string", "integer", "boolean", "json"] as const;
const SETTING_GROUPS = Object.keys(GROUP_LABELS);

// ── SettingInput ──────────────────────────────────────────────────────────────

function SettingInput({
  keyName,
  value,
  type,
  isSensitive,
  onChange,
}: {
  keyName: string;
  value: unknown;
  type: string;
  isSensitive: boolean;
  onChange: (v: unknown) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  if (type === "boolean") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    );
  }

  if (type === "json") {
    return (
      <textarea
        value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white text-xs font-mono resize-none focus:outline-none focus:border-white/30"
      />
    );
  }

  if (isSensitive) {
    return (
      <div className="relative flex items-center max-w-xs">
        <Lock className="absolute left-2.5 w-3 h-3 text-slate-500 pointer-events-none" />
        <Input
          type={revealed ? "text" : "password"}
          value={value === null ? "" : String(value ?? "")}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          placeholder="••••••••"
          aria-label={`${keyName} (sensitive)`}
          className="bg-slate-800 border-white/10 text-white text-sm h-8 pl-7 pr-8 max-w-xs font-mono placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="absolute right-2 text-slate-500 hover:text-slate-300"
          aria-label={revealed ? "Hide value" : "Show value"}
        >
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <Input
      type={type === "integer" ? "number" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(type === "integer" ? Number(e.target.value) : e.target.value)}
      className="bg-slate-800 border-white/10 text-white text-sm h-8 max-w-xs"
    />
  );
}

// ── SMTP Test Panel ───────────────────────────────────────────────────────────

function SmtpTestPanel() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [lastResult, setLastResult] = useState<"success" | "error" | null>(null);

  const mutation = useMutation({
    mutationFn: (to: string) =>
      adminFetch<{ data: { sent_to: string }; message: string }>("/settings/smtp-test", {
        method: "POST",
        body: JSON.stringify({ to }),
      }),
    onSuccess: (res) => {
      setLastResult("success");
      toast({ title: "Test email sent", description: res.message });
    },
    onError: (e: Error) => {
      setLastResult("error");
      toast({ title: "SMTP test failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="px-5 py-4 border-t border-white/10 bg-white/3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Test SMTP Configuration
      </p>
      <div className="flex items-center gap-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Send test to email@example.com"
          className="bg-slate-800 border-white/10 text-white text-sm h-8 max-w-xs placeholder:text-slate-500"
        />
        <Button
          size="sm"
          variant="outline"
          className="border-white/10 text-slate-300 hover:bg-white/10 shrink-0"
          disabled={!email || mutation.isPending}
          onClick={() => mutation.mutate(email)}
        >
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Mail className="w-3.5 h-3.5 mr-1.5" />
          )}
          Send Test Email
        </Button>
        {lastResult === "success" && !mutation.isPending && (
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        {lastResult === "error" && !mutation.isPending && (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        )}
      </div>
    </div>
  );
}

// ── New Setting Dialog ────────────────────────────────────────────────────────

interface NewSettingForm {
  key: string;
  value: string;
  type: string;
  group: string;
  description: string;
}

const EMPTY_NEW: NewSettingForm = { key: "", value: "", type: "string", group: "general", description: "" };

function NewSettingDialog({
  open,
  onClose,
  onSave,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: NewSettingForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<NewSettingForm>(EMPTY_NEW);
  const set = (field: keyof NewSettingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY_NEW);
    onClose();
  };

  const handleSubmit = () => {
    if (!form.key.trim() || !form.value.trim()) return;
    onSave(form);
    setForm(EMPTY_NEW);
  };

  const inputClass = "w-full bg-slate-800 border border-white/10 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-slate-600";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Add New Setting</DialogTitle>
          <DialogDescription className="text-slate-400">
            Create a custom platform setting key. Use dot notation for namespacing (e.g.{" "}
            <code className="text-slate-300">feature.my_flag</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className={labelClass}>Key *</label>
            <input
              className={inputClass}
              value={form.key}
              onChange={set("key")}
              placeholder="e.g. feature.beta_mode"
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Value *</label>
            <input
              className={inputClass}
              value={form.value}
              onChange={set("value")}
              placeholder="Setting value"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={form.type} onChange={set("type")}>
                {SETTING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Group</label>
              <select className={inputClass} value={form.group} onChange={set("group")}>
                {SETTING_GROUPS.map((g) => (
                  <option key={g} value={g}>{GROUP_LABELS[g] ?? g}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <input
              className={inputClass}
              value={form.description}
              onChange={set("description")}
              placeholder="Brief description of this setting"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="text-slate-400" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.key.trim() || !form.value.trim() || isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            Add Setting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [newSettingOpen, setNewSettingOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminFetch<{ data: SettingsData }>("/settings").then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (payload: { settings: Record<string, unknown>; meta?: Record<string, unknown> }) =>
      adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      setEdits({});
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (form: NewSettingForm) =>
      adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          settings: { [form.key]: form.value },
          meta: {
            [form.key]: {
              type: form.type,
              group: form.group,
              description: form.description || null,
            },
          },
        }),
      }),
    onSuccess: () => {
      toast({ title: "Setting added" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      setNewSettingOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error adding setting", description: e.message, variant: "destructive" }),
  });

  const handleChange = (key: string, value: unknown) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string, setting: AdminSetting) => {
    if (key in edits) return edits[key];
    // Sensitive fields: API returns null — don't pre-fill; let input start empty
    if (setting.is_sensitive) return null;
    return setting.value;
  };

  // Build the PATCH payload — omit null values for sensitive fields (unchanged)
  const buildSavePayload = () => {
    const settings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(edits)) {
      if (v === null) continue; // sensitive field was not changed — skip
      settings[k] = v;
    }
    return { settings };
  };

  const maintenanceKey = "maintenance_mode";
  const isMaintenanceMode = (() => {
    if (maintenanceKey in edits) return Boolean(edits[maintenanceKey]);
    return data
      ? Object.values(data).some((group) =>
          maintenanceKey in group ? Boolean(group[maintenanceKey]?.value) : false
        )
      : false;
  })();

  const handleMaintenanceToggle = () => {
    if (!isMaintenanceMode) {
      setMaintenanceDialogOpen(true);
    } else {
      handleChange(maintenanceKey, false);
    }
  };

  const handleSave = () => {
    const payload = buildSavePayload();
    if (Object.keys(payload.settings).length === 0) return;
    mutation.mutate(payload);
  };

  // Count editable (non-null) pending changes
  const pendingCount = Object.values(edits).filter((v) => v !== null).length;
  const hasChanges = pendingCount > 0;

  const allGroups    = Object.keys(GROUP_LABELS);
  const presentGroups = data ? allGroups.filter((g) => g in data) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure platform-wide settings. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/10"
            onClick={() => setNewSettingOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Setting
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || mutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {hasChanges
              ? `Save ${pendingCount} change${pendingCount !== 1 ? "s" : ""}`
              : "No changes"}
          </Button>
        </div>
      </div>

      {/* Maintenance mode big toggle */}
      <div
        className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${
          isMaintenanceMode
            ? "bg-red-950/40 border-red-400/30"
            : "bg-slate-900 border-white/10"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-5 h-5 ${isMaintenanceMode ? "text-red-400" : "text-slate-400"}`}
            />
            <h3 className={`font-semibold ${isMaintenanceMode ? "text-red-300" : "text-white"}`}>
              Maintenance Mode
            </h3>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {isMaintenanceMode
              ? "Platform is currently in maintenance mode. All user logins are blocked."
              : "Enable to block all user logins and show a maintenance page."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isMaintenanceMode}
          onClick={handleMaintenanceToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isMaintenanceMode ? "bg-red-500" : "bg-slate-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isMaintenanceMode ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Settings groups */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : (
        presentGroups.map((group) => {
          const settings = data![group];
          return (
            <div
              key={group}
              className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/5">
                <h2 className="text-sm font-semibold text-white">
                  {GROUP_LABELS[group] ?? group}
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {Object.entries(settings)
                  .filter(([key]) => key !== maintenanceKey)
                  .map(([key, setting]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-white font-medium">{key}</p>
                          {setting.is_sensitive && (
                            <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-label="Sensitive" />
                          )}
                        </div>
                        {setting.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {setting.description}
                          </p>
                        )}
                        {setting.is_sensitive && (
                          <p className="text-xs text-amber-600/80 mt-0.5">
                            Leave blank to keep current value
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <SettingInput
                          keyName={key}
                          value={getValue(key, setting)}
                          type={setting.type}
                          isSensitive={setting.is_sensitive ?? false}
                          onChange={(v) => handleChange(key, v)}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* SMTP test panel — shown only in the "mail" group */}
              {group === "mail" && <SmtpTestPanel />}
            </div>
          );
        })
      )}

      {/* Maintenance confirmation dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-red-300">Enable Maintenance Mode</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will immediately block all user logins across the platform. Only admin users
              will be able to access the system. You must save settings to apply this change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleChange(maintenanceKey, true);
                setMaintenanceDialogOpen(false);
              }}
            >
              Enable Maintenance Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Setting dialog */}
      <NewSettingDialog
        open={newSettingOpen}
        onClose={() => setNewSettingOpen(false)}
        onSave={(form) => addMutation.mutate(form)}
        isPending={addMutation.isPending}
      />
    </div>
  );
}
