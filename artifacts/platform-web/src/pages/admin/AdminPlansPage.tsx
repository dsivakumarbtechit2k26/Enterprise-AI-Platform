import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch, type AdminPlan } from "@/lib/adminApi";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, DollarSign, Zap, Package } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  max_users:            "Max Users",
  storage_gb:           "Storage (GB)",
  api_calls_per_month:  "API Calls / Month",
  ai_features:          "AI Features",
  custom_domain:        "Custom Domain",
  priority_support:     "Priority Support",
  sso:                  "SSO",
};

function PlanCard({ plan }: { plan: AdminPlan }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing]               = useState(false);
  const [editedFeatures, setEditedFeatures] = useState<Record<string, string>>({});
  const [editedPrice, setEditedPrice]       = useState(String(plan.price_cents));

  const mutation = useMutation({
    mutationFn: (payload: { price_cents?: number; features?: Record<string, string> }) =>
      adminFetch(`/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: `"${plan.name}" updated` });
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
      features:    editedFeatures,
    });
  };

  const allFeatureKeys = Array.from(
    new Set([...Object.keys(plan.features), ...Object.keys(FEATURE_LABELS)]),
  );

  const priceDisplay = plan.price_cents === 0
    ? "Free"
    : `$${(plan.price_cents / 100).toFixed(2)} / ${plan.interval}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">{plan.name}</h3>
              {!plan.is_active && (
                <Badge variant="outline" className="text-[10px] shrink-0">Inactive</Badge>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{plan.key}</p>
            {plan.description && (
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
            )}
          </div>

          {!editing ? (
            <Button variant="ghost" size="sm" className="shrink-0 h-7 gap-1.5 text-xs" onClick={handleEdit}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} disabled={mutation.isPending}>
                <Check className="w-3 h-3" /> Save
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pt-0">
        {/* Price */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                className="h-7 w-28 text-sm"
                placeholder="cents"
              />
              <span className="text-xs text-muted-foreground">
                cents (= ${(parseInt(editedPrice || "0") / 100).toFixed(2)}/mo)
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium">{priceDisplay}</span>
          )}
        </div>

        <Separator />

        {/* Features grid */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Limits &amp; Features</p>
          <div className="grid grid-cols-1 gap-1.5">
            {allFeatureKeys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 gap-4"
              >
                <span className="text-xs text-muted-foreground truncate">
                  {FEATURE_LABELS[key] ?? key}
                </span>
                {editing ? (
                  <Input
                    value={editedFeatures[key] ?? ""}
                    onChange={(e) =>
                      setEditedFeatures((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="h-6 w-20 text-xs text-right px-2 shrink-0"
                    placeholder="—"
                  />
                ) : (
                  <span className="text-xs font-semibold tabular-nums shrink-0">
                    {plan.features[key] ?? <span className="text-muted-foreground/50">—</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stripe price ID */}
        {plan.stripe_price_id && (
          <div className="pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Stripe Price ID</p>
            <p className="text-xs font-mono text-muted-foreground/70 break-all">{plan.stripe_price_id}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => adminFetch<{ data: AdminPlan[] }>("/plans").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-muted-foreground" />
            Subscription Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit plan limits and pricing — changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5 border border-dashed">
          <Zap className="w-3 h-3 text-primary" />
          Run <code className="font-mono mx-1">billing:create-stripe-plans</code> to sync prices to Stripe
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
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
