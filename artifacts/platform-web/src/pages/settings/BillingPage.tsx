import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useGetSubscription,
  useListPlans,
  useListInvoices,
  downloadInvoice,
  useCreatePortalSession,
  useCreateCheckout,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  ExternalLink,
  Zap,
  Check,
  Loader2,
  ShieldCheck,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function quotaPct(used?: number | null, limit?: number | null) {
  if (used == null || !limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function QuotaRow({
  label,
  used,
  limit,
  unit = "",
}: {
  label: string;
  used?: number | null;
  limit?: number | null;
  unit?: string;
}) {
  const pct = quotaPct(used, limit);
  const isDanger = pct >= 90;
  const isWarn   = pct >= 70 && pct < 90;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`text-xs tabular-nums ${isDanger ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {(used ?? 0).toLocaleString()}{unit} /{" "}
          {limit ? `${limit.toLocaleString()}${unit}` : "∞"}
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-1.5 ${isDanger ? "[&>div]:bg-destructive" : isWarn ? "[&>div]:bg-warning" : ""}`}
      />
    </div>
  );
}

// ── invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: { id: string; amount_due: number; currency: string; status: string; date: string; pdf_url?: string | null } }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await downloadInvoice(invoice.id);
      if (res?.url) window.open(res.url, "_blank");
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{fmt(invoice.amount_due, invoice.currency)}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(invoice.date)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant={invoice.status === "paid" ? "default" : invoice.status === "open" ? "secondary" : "destructive"}
          className="text-[10px] capitalize"
        >
          {invoice.status}
        </Badge>
        {invoice.pdf_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            disabled={loading}
            title="Download PDF"
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant } = useAuthStore();
  const isPlatformAdmin = !tenant;

  // Handle Stripe checkout return
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast({
        title: "Subscription activated!",
        description: "Your plan has been upgraded successfully. Welcome!",
      });
      setSearchParams({}, { replace: true });
    } else if (checkout === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "No changes were made to your subscription.",
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { data: subData, isLoading: subLoading } = useGetSubscription();
  const { data: plansData, isLoading: plansLoading } = useListPlans();
  const { data: invoicesData, isLoading: invoicesLoading } = useListInvoices({
    query: { enabled: !isPlatformAdmin },
  });

  const portalMutation  = useCreatePortalSession();
  const checkoutMutation = useCreateCheckout();

  const handleManageBilling = () => {
    portalMutation.mutate(undefined, {
      onSuccess: (res: any) => { if (res?.url) window.location.href = res.url; },
      onError: () => toast({ title: "Could not open billing portal", variant: "destructive" }),
    });
  };

  const handleUpgrade = (priceId: string) => {
    checkoutMutation.mutate(
      { data: { price_id: priceId } },
      {
        onSuccess: (res: any) => { if (res?.url) window.location.href = res.url; },
        onError: () => toast({ title: "Could not start checkout", variant: "destructive" }),
      },
    );
  };

  if (subLoading || plansLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const plans       = plansData?.data ?? [];
  const subscription = subData?.subscription;
  const isFree      = !subscription || subscription.plan_key === "free";
  const invoices    = invoicesData?.data ?? [];

  const statusColor = {
    active:     "default",
    trialing:   "secondary",
    past_due:   "destructive",
    canceled:   "outline",
    incomplete: "outline",
  } as const;

  return (
    <div className="space-y-8 max-w-5xl pb-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing &amp; Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isPlatformAdmin
            ? "Platform-level view — individual tenant billing is managed per-organization."
            : "Manage your plan, quotas, payment methods, and invoices."}
        </p>
      </div>

      {/* Platform admin notice */}
      {isPlatformAdmin ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" /> Platform Administration Account
            </CardTitle>
            <CardDescription>
              This account operates at the platform level and does not carry a tenant subscription.
              To manage a tenant's billing, go to <strong>Admin → Tenants</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* ── Current plan + quota ── */}
          <div className="grid gap-5 md:grid-cols-2">

            {/* Plan card */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" /> Current Plan
                    </CardTitle>
                    <p className="text-2xl font-bold mt-2 tracking-tight">
                      {subscription?.plan_name ?? "Free"}
                    </p>
                  </div>
                  {subscription?.status && (
                    <Badge
                      variant={statusColor[subscription.status as keyof typeof statusColor] ?? "secondary"}
                      className="capitalize text-xs shrink-0"
                    >
                      {subscription.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    ${plans.find((p) => p.key === subscription?.plan_key)?.price_monthly ?? 0}
                  </span>
                  <span className="text-muted-foreground text-sm">/ month</span>
                </div>
                {subscription?.cancel_at_period_end && (
                  <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Cancels at end of billing period
                      {subscription.current_period_end && (
                        <> ({fmtDate(subscription.current_period_end)})</>
                      )}
                    </span>
                  </div>
                )}
                {subscription?.current_period_end && !subscription.cancel_at_period_end && (
                  <p className="text-xs text-muted-foreground">
                    Renews on {fmtDate(subscription.current_period_end)}
                  </p>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={portalMutation.isPending || isFree}
                  className="gap-2"
                >
                  {portalMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <CreditCard className="w-3.5 h-3.5" />}
                  Manage Payment &amp; Billing
                  {!portalMutation.isPending && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                </Button>
              </CardFooter>
            </Card>

            {/* Quota card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usage This Cycle</CardTitle>
                <CardDescription className="text-xs">
                  Resets at the start of each billing period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <QuotaRow
                  label="Active Users"
                  used={subscription?.quota?.users_count}
                  limit={subscription?.quota?.users_limit}
                />
                <QuotaRow
                  label="API Calls"
                  used={subscription?.quota?.api_calls_used}
                  limit={subscription?.quota?.api_calls_limit}
                />
                <QuotaRow
                  label="Storage"
                  used={subscription?.quota?.storage_used_mb}
                  limit={subscription?.quota?.storage_limit_mb}
                  unit=" MB"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Invoices ── */}
          <div>
            <h2 className="text-base font-semibold mb-3">Invoices</h2>
            <Card>
              {invoicesLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No invoices yet.</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">They will appear here once you subscribe to a paid plan.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {invoices.map((inv) => (
                    <InvoiceRow key={inv.id} invoice={inv} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ── Available plans (everyone) ── */}
      <Separator />
      <div>
        <h2 className="text-base font-semibold mb-1">Available Plans</h2>
        <p className="text-sm text-muted-foreground mb-5">Choose the plan that fits your team.</p>

        {plans.length === 0 ? (
          <p className="text-muted-foreground text-sm">No plans available at this time.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan_key === plan.key;
              const isPopular = plan.key === "professional_monthly";

              return (
                <Card
                  key={plan.key}
                  className={`flex flex-col relative transition-all ${
                    isCurrent
                      ? "border-primary/60 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                      : isPopular
                      ? "border-primary/30"
                      : ""
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-px left-0 right-0 h-0.5 rounded-t-full bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
                  )}
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="text-[10px] px-2 shadow-sm">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {plan.name}
                      {isCurrent && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </CardTitle>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold">${plan.price_monthly}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-3 border-t">
                    {isPlatformAdmin ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Admin View
                      </Button>
                    ) : isCurrent ? (
                      <Button variant="secondary" size="sm" className="w-full" disabled>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Current Plan
                      </Button>
                    ) : (
                      <Button
                        variant={isPopular ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        onClick={() => plan.stripe_price_id && handleUpgrade(plan.stripe_price_id)}
                        disabled={!plan.stripe_price_id || checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending && (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        )}
                        {plan.price_monthly === 0 ? "Downgrade to Free" : `Upgrade to ${plan.name}`}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
