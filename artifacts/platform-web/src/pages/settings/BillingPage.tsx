import { 
  useGetSubscription, 
  useListPlans, 
  useCreatePortalSession, 
  useCreateCheckout 
} from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ExternalLink, Zap, Check, Loader2, ShieldCheck } from "lucide-react";

export default function BillingPage() {
  const { toast } = useToast();
  const { tenant, hasPermission } = useAuthStore();
  const isPlatformAdmin = !tenant;

  const { data: subData, isLoading: subLoading, isError: subError } = useGetSubscription();
  const { data: plansData, isLoading: plansLoading } = useListPlans();

  const portalMutation = useCreatePortalSession();
  const checkoutMutation = useCreateCheckout();

  const handleManageBilling = () => {
    portalMutation.mutate(undefined, {
      onSuccess: (res: any) => {
        if (res?.url) window.location.href = res.url;
      },
      onError: () => {
        toast({ title: "Error", description: "Could not open billing portal. Please try again.", variant: "destructive" });
      }
    });
  };

  const handleUpgrade = (priceId: string) => {
    checkoutMutation.mutate({ data: { price_id: priceId } }, {
      onSuccess: (res: any) => {
        if (res?.url) window.location.href = res.url;
      },
      onError: () => {
        toast({ title: "Error", description: "Could not start checkout process.", variant: "destructive" });
      }
    });
  };

  const getQuotaPercentage = (used?: number, limit?: number | null) => {
    if (!used || !limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  if (subLoading || plansLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const plans = plansData?.data || [];
  const subscription = subData?.subscription;
  const isFree = !subscription || subscription.plan_key === 'free';

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">
          {isPlatformAdmin
            ? "Platform-level billing overview — tenant subscriptions are managed per-organization."
            : "Manage your plan, quotas, and payment methods."}
        </p>
      </div>

      {/* Platform admin: no tenant subscription — show informational banner */}
      {(isPlatformAdmin || subError || !subscription) && !subLoading ? (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" /> Platform Administration Account
            </CardTitle>
            <CardDescription className="text-blue-600/80 dark:text-blue-300/80">
              This account operates at the platform level and does not have a tenant subscription.
              Individual tenant billing is managed from each tenant's settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To manage a tenant's subscription, navigate to <strong>Admin → Tenants</strong> and open the tenant's detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Tenant user: show full subscription + quota UI */
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-4 -mt-4" />
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Current Plan
                  </CardTitle>
                  <CardDescription className="mt-1">
                    You are currently on the{" "}
                    <strong className="text-foreground capitalize">
                      {subscription?.plan_name || subscription?.plan_key || "Free"}
                    </strong>{" "}
                    plan.
                  </CardDescription>
                </div>
                <Badge
                  variant={subscription?.status === "active" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {subscription?.status || "Free"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 my-4">
                <span className="text-4xl font-bold">
                  ${plans.find((p) => p.key === subscription?.plan_key)?.price_monthly || "0"}
                </span>
                <span className="text-muted-foreground mb-1">/ month</span>
              </div>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground mt-4">
                  Current billing period ends on{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6 bg-muted/10">
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={portalMutation.isPending || isFree}
              >
                {portalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Payment Methods
                <ExternalLink className="w-3 h-3 ml-2 text-muted-foreground" />
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage & Quotas</CardTitle>
              <CardDescription>Your resource usage for the current billing cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Active Users</span>
                  <span className="text-muted-foreground">
                    {subscription?.quota?.users_count || 0} /{" "}
                    {subscription?.quota?.users_limit ?? "∞"}
                  </span>
                </div>
                <Progress
                  value={getQuotaPercentage(
                    subscription?.quota?.users_count,
                    subscription?.quota?.users_limit
                  )}
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">API Calls</span>
                  <span className="text-muted-foreground">
                    {(subscription?.quota?.api_calls_used || 0).toLocaleString()} /{" "}
                    {subscription?.quota?.api_calls_limit
                      ? subscription.quota.api_calls_limit.toLocaleString()
                      : "∞"}
                  </span>
                </div>
                <Progress
                  value={getQuotaPercentage(
                    subscription?.quota?.api_calls_used,
                    subscription?.quota?.api_calls_limit
                  )}
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Storage</span>
                  <span className="text-muted-foreground">
                    {subscription?.quota?.storage_used_mb || 0}MB /{" "}
                    {subscription?.quota?.storage_limit_mb
                      ? `${subscription.quota.storage_limit_mb}MB`
                      : "∞"}
                  </span>
                </div>
                <Progress
                  value={getQuotaPercentage(
                    subscription?.quota?.storage_used_mb,
                    subscription?.quota?.storage_limit_mb
                  )}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Plans — shown for everyone */}
      <div className="pt-4">
        <h2 className="text-2xl font-bold tracking-tight mb-6">Available Plans</h2>
        {plans.length === 0 ? (
          <p className="text-muted-foreground">No plans available at this time.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.key}
                className={`flex flex-col relative ${
                  subscription?.plan_key === plan.key ? "border-primary shadow-sm" : ""
                }`}
              >
                {subscription?.plan_key === plan.key && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    CURRENT
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold">${plan.price_monthly}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isPlatformAdmin ? (
                    <Button variant="outline" className="w-full" disabled>
                      Admin View
                    </Button>
                  ) : subscription?.plan_key === plan.key ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={plan.key === "professional_monthly" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => plan.stripe_price_id && handleUpgrade(plan.stripe_price_id)}
                      disabled={!plan.stripe_price_id || checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Upgrade to {plan.name}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
