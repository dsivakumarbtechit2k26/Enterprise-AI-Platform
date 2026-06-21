import { useEffect, useState } from "react";
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
import { Save, AlertTriangle } from "lucide-react";

type SettingsData = Record<string, Record<string, AdminSetting>>;

const GROUP_LABELS: Record<string, string> = {
  general:  "General",
  auth:     "Authentication",
  mail:     "Email / SMTP",
  billing:  "Billing",
  features: "Feature Flags",
};

function SettingInput({
  value,
  type,
  onChange,
}: {
  value: unknown;
  type: string;
  onChange: (v: unknown) => void;
}) {
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

  return (
    <Input
      type={type === "integer" ? "number" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(type === "integer" ? Number(e.target.value) : e.target.value)}
      className="bg-slate-800 border-white/10 text-white text-sm h-8 max-w-xs"
    />
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminFetch<{ data: SettingsData }>("/settings").then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      setEdits({});
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleChange = (key: string, value: unknown) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string, setting: AdminSetting) => {
    return key in edits ? edits[key] : setting.value;
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
    if (Object.keys(edits).length === 0) return;
    mutation.mutate(edits);
  };

  const hasChanges = Object.keys(edits).length > 0;

  const allGroups = Object.keys(GROUP_LABELS);
  const presentGroups = data
    ? allGroups.filter((g) => g in data)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure platform-wide settings. Changes take effect immediately.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || mutation.isPending}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {hasChanges ? `Save ${Object.keys(edits).length} change${Object.keys(edits).length !== 1 ? "s" : ""}` : "No changes"}
        </Button>
      </div>

      {/* Maintenance mode big toggle */}
      <div className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${
        isMaintenanceMode
          ? "bg-red-950/40 border-red-400/30"
          : "bg-slate-900 border-white/10"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isMaintenanceMode ? "text-red-400" : "text-slate-400"}`} />
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
            <div key={group} className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 bg-white/5">
                <h2 className="text-sm font-semibold text-white">
                  {GROUP_LABELS[group] ?? group}
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {Object.entries(settings)
                  .filter(([key]) => key !== maintenanceKey)
                  .map(([key, setting]) => (
                    <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium">{key}</p>
                        {setting.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <SettingInput
                          value={getValue(key, setting)}
                          type={setting.type}
                          onChange={(v) => handleChange(key, v)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
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
              This will immediately block all user logins across the platform. Only admin users will be able to access the system. You must save settings to apply this change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaintenanceDialogOpen(false)}>Cancel</Button>
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
    </div>
  );
}
