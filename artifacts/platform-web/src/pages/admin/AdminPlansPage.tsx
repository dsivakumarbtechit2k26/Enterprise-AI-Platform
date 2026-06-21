import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch, type AdminPlan } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, DollarSign } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  max_users:          "Max Users",
  storage_gb:         "Storage (GB)",
  api_calls_per_month:"API Calls / Month",
  ai_features:        "AI Features",
  custom_domain:      "Custom Domain",
  priority_support:   "Priority Support",
  sso:                "SSO",
};

function PlanCard({ plan }: { plan: AdminPlan }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing]           = useState(false);
  const [editedFeatures, setEditedFeatures] = useState<Record<string, string>>({});
  const [editedPrice, setEditedPrice]   = useState(String(plan.price_cents));

  const mutation = useMutation({
    mutationFn: (payload: { price_cents?: number; features?: Record<string, string> }) =>
      adminFetch(`/plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: `Plan "${plan.name}" updated` });
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      setEditing(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = () => {
    setEditedFeatures({ ...plan.features });
    setEditedPrice(String(plan.price_cents));
    setEditing(true);
  };

  const handleSave = () => {
    const priceCents = parseInt(editedPrice, 10);
    mutation.mutate({
      price_cents: isNaN(priceCents) ? plan.price_cents : priceCents,
      features: editedFeatures,
    });
  };

  const allFeatureKeys = Array.from(
    new Set([...Object.keys(plan.features), ...Object.keys(FEATURE_LABELS)])
  );

  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
            {!plan.is_active && (
              <Badge variant="outline" className="border-slate-600 text-slate-500 text-xs">Inactive</Badge>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{plan.key}</p>
          {plan.description && (
            <p className="text-slate-400 text-sm mt-1">{plan.description}</p>
          )}
        </div>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={handleEdit}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-8"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 h-8"
              onClick={() => setEditing(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-slate-500" />
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={editedPrice}
              onChange={(e) => setEditedPrice(e.target.value)}
              className="h-7 w-28 bg-slate-800 border-white/20 text-white text-sm"
              placeholder="cents"
            />
            <span className="text-slate-500 text-xs">cents/mo (${(parseInt(editedPrice || "0") / 100).toFixed(2)})</span>
          </div>
        ) : (
          <span className="text-white font-medium">
            {plan.price_cents === 0 ? "Free" : `$${(plan.price_cents / 100).toFixed(2)}/${plan.interval}`}
          </span>
        )}
      </div>

      {/* Features */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Features</p>
        <div className="grid grid-cols-2 gap-2">
          {allFeatureKeys.map((key) => (
            <div key={key} className="flex items-center justify-between bg-slate-800/60 rounded-md px-3 py-1.5">
              <span className="text-xs text-slate-400">{FEATURE_LABELS[key] ?? key}</span>
              {editing ? (
                <Input
                  value={editedFeatures[key] ?? ""}
                  onChange={(e) =>
                    setEditedFeatures((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="h-6 w-20 bg-slate-700 border-white/20 text-white text-xs text-right px-2"
                />
              ) : (
                <span className="text-xs text-white font-medium">
                  {plan.features[key] ?? "—"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => adminFetch<{ data: AdminPlan[] }>("/plans").then((r) => r.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
        <p className="text-slate-400 text-sm mt-1">
          Edit plan limits and pricing inline — changes take effect immediately.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data ?? []).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
