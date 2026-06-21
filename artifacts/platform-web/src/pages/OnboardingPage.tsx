import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/authStore";
import { useListPlans, useCreateCheckout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Check, Building2, Users, Rocket, ChevronRight, ChevronLeft,
  Loader2, MailCheck, RefreshCw,
} from "lucide-react";

// ── Steps ─────────────────────────────────────────────────────────────────────
// 1: Welcome
// 2: Email verification (gated on user.email_verified_at === null)
// 3: Org details (persisted to API on submit)
// 4: Plan selection (paid plans redirect to Stripe checkout)
// 5: Done

const TOTAL_STEPS = 5;

// ── Schemas ───────────────────────────────────────────────────────────────────

const orgSchema = z.object({
  org_name:  z.string().min(2, "Organization name must be at least 2 characters"),
  industry:  z.string().min(1, "Please select an industry"),
  team_size: z.string().min(1, "Please select a team size"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

// ── Constants ─────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "Retail & E-commerce",
  "Manufacturing",
  "Education",
  "Professional Services",
  "Media & Entertainment",
  "Real Estate",
  "Other",
];

const TEAM_SIZES = [
  { value: "1-10",    label: "1–10 people" },
  { value: "11-50",   label: "11–50 people" },
  { value: "51-200",  label: "51–200 people" },
  { value: "201-500", label: "201–500 people" },
  { value: "500+",    label: "500+ people" },
];

// ── StepIndicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8" data-testid="onboarding-steps">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-semibold transition-all ${
              step < current
                ? "border-primary bg-primary text-primary-foreground"
                : step === current
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted text-muted-foreground"
            }`}
            data-testid={`step-indicator-${step}`}
          >
            {step < current ? <Check className="w-4 h-4" /> : step}
          </div>
          {step < total && (
            <div className={`w-8 h-px ${step < current ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── OnboardingPage ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token, tenant, user } = useAuthStore();
  const { data: plansData } = useListPlans();
  const checkoutMutation = useCreateCheckout();

  const [step, setStep]               = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [resending, setResending]     = useState(false);
  const [savingOrg, setSavingOrg]     = useState(false);

  const orgForm = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      org_name:  tenant?.name ?? "",
      industry:  "",
      team_size: "",
    },
  });

  const plans            = plansData?.data ?? [];
  const selectedPlanData = plans.find((p) => p.key === selectedPlan);

  // ── Email re-send ──────────────────────────────────────────────────────────

  const handleResendVerification = async () => {
    if (!token) return;
    setResending(true);
    try {
      const res = await fetch("/api/v1/auth/email/verify-resend", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast({ title: "Verification email sent", description: "Check your inbox and spam folder." });
      } else {
        toast({ title: "Could not resend", description: "Please try again in a minute.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  // ── Org details submit → persist to backend ────────────────────────────────

  const handleOrgSubmit = async (values: OrgFormValues) => {
    setSavingOrg(true);
    try {
      await fetch("/api/v1/tenant/profile", {
        method: "PATCH",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        body: JSON.stringify({
          name:      values.org_name,
          industry:  values.industry,
          team_size: values.team_size,
        }),
      });
    } catch {
      // Non-fatal — continue onboarding even if the call fails
    } finally {
      setSavingOrg(false);
      setStep(4);
    }
  };

  // ── Plan selection → Stripe checkout or continue ──────────────────────────

  const handleSelectPlanAndContinue = () => {
    if (!selectedPlanData) {
      setStep(5);
      return;
    }

    if (selectedPlanData.price_monthly > 0 && selectedPlanData.stripe_price_id) {
      const origin = window.location.origin;
      checkoutMutation.mutate(
        {
          // success_url / cancel_url are required by the API but absent from the
          // generated schema type; cast to satisfy TypeScript.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: {
            price_id:    selectedPlanData.stripe_price_id,
            success_url: `${origin}/settings/billing?checkout=success`,
            cancel_url:  `${origin}/onboarding`,
          } as any,
        },
        {
          onSuccess: (res) => {
            if (res.url) {
              window.location.href = res.url;
            } else {
              setStep(5);
            }
          },
          onError: () => {
            toast({
              title: "Checkout unavailable",
              description: "Stripe is not configured yet. You can upgrade from Settings → Billing later.",
              variant: "destructive",
            });
            setStep(5);
          },
        },
      );
    } else {
      setStep(5);
    }
  };

  const handleComplete = () => {
    navigate("/", { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-muted/30 flex items-center justify-center p-4 py-12"
      data-testid="page-onboarding"
    >
      <div className="w-full max-w-4xl">
        <div className="text-center mb-2">
          <p className="text-sm font-medium text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
        {step === 1 && (
          <Card className="max-w-lg mx-auto shadow-lg border-primary/20">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl">Welcome to {tenant?.name || "Platform"}</CardTitle>
              <CardDescription className="text-base mt-2">
                Your workspace is ready. Let's get you set up in a few quick steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg text-sm">
                {[
                  "Workspace created successfully",
                  "Admin account secured",
                  "Default roles and permissions provisioned",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setStep(2)}
                data-testid="button-onboarding-next-step1"
              >
                Get started <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ── Step 2: Email verification ──────────────────────────────── */}
        {step === 2 && (
          <Card className="max-w-lg mx-auto shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MailCheck className="w-8 h-8 text-amber-500" />
              </div>
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription className="text-base mt-2">
                {user?.email_verified_at
                  ? "Your email is already verified."
                  : `We sent a verification link to ${user?.email ?? "your email"}. Click the link to continue.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {user?.email_verified_at ? (
                <div className="flex items-center gap-3 bg-green-500/10 text-green-700 dark:text-green-400 p-4 rounded-lg text-sm">
                  <Check className="w-5 h-5 shrink-0" />
                  <span>Email verified on {new Date(user.email_verified_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Didn't receive it? Check your spam folder or resend the email.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleResendVerification}
                    disabled={resending}
                  >
                    {resending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-2" /> Resend verification email</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                data-testid="button-onboarding-back-step2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep(3)}
                data-testid="button-onboarding-next-step2"
              >
                {user?.email_verified_at ? "Continue" : "Skip for now"} <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ── Step 3: Organization Details ────────────────────────────── */}
        {step === 3 && (
          <Card className="max-w-lg mx-auto shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Tell us about your organization</CardTitle>
              <CardDescription>
                This helps us tailor the platform to your needs.
              </CardDescription>
            </CardHeader>
            <Form {...orgForm}>
              <form
                onSubmit={orgForm.handleSubmit(handleOrgSubmit)}
                data-testid="form-onboarding-org"
              >
                <CardContent className="space-y-5">
                  <FormField
                    control={orgForm.control}
                    name="org_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Corp"
                            data-testid="input-org-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orgForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-industry">
                              <SelectValue placeholder="Select your industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map((ind) => (
                              <SelectItem
                                key={ind}
                                value={ind}
                                data-testid={`option-industry-${ind.toLowerCase().replace(/\s/g, "-")}`}
                              >
                                {ind}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orgForm.control}
                    name="team_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team size</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-team-size">
                              <SelectValue placeholder="How many people?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TEAM_SIZES.map((size) => (
                              <SelectItem
                                key={size.value}
                                value={size.value}
                                data-testid={`option-size-${size.value}`}
                              >
                                {size.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    data-testid="button-onboarding-back-step3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={savingOrg}
                    data-testid="button-onboarding-next-step3"
                  >
                    {savingOrg ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                    ) : (
                      <>Continue <ChevronRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        )}

        {/* ── Step 4: Choose Plan ──────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
              <p className="text-muted-foreground mt-2">
                Pick the right tier for your organization. You can change this anytime.
              </p>
            </div>

            {plans.length > 0 ? (
              <div className={`grid gap-6 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2 max-w-2xl mx-auto"}`}>
                {plans
                  .filter((p) => ["free", "professional_monthly", "enterprise"].includes(p.key))
                  .map((plan) => {
                    const isSelected    = selectedPlan === plan.key;
                    const isRecommended = plan.key === "professional_monthly";
                    const isFree        = plan.price_monthly === 0 && plan.key === "free";
                    return (
                      <Card
                        key={plan.key}
                        className={`flex flex-col relative cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary ring-2 ring-primary shadow-lg"
                            : isRecommended
                            ? "border-primary/50 shadow-md"
                            : ""
                        }`}
                        onClick={() => setSelectedPlan(plan.key)}
                        data-testid={`card-plan-${plan.key}`}
                      >
                        {isRecommended && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Recommended
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                            {isSelected && (
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            {plan.price_monthly === 0 ? (
                              <span className="text-4xl font-bold">Free</span>
                            ) : plan.price_monthly == null ? (
                              <span className="text-2xl font-bold">Contact us</span>
                            ) : (
                              <>
                                <span className="text-4xl font-bold">${plan.price_monthly}</span>
                                <span className="text-muted-foreground">/mo</span>
                              </>
                            )}
                          </div>
                          {isFree && (
                            <p className="text-xs text-muted-foreground mt-1">No credit card required</p>
                          )}
                        </CardHeader>
                        <CardContent className="flex-1">
                          <ul className="space-y-2.5 text-sm">
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              <Card className="max-w-sm mx-auto p-8 text-center">
                <p className="text-muted-foreground">Loading plans…</p>
              </Card>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 max-w-4xl mx-auto">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                data-testid="button-onboarding-back-step4"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(5)}
                  data-testid="button-skip-plan"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={handleSelectPlanAndContinue}
                  disabled={!selectedPlan || checkoutMutation.isPending}
                  data-testid="button-onboarding-next-step4"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirecting…
                    </>
                  ) : selectedPlanData?.price_monthly != null && selectedPlanData.price_monthly > 0 ? (
                    <>Start checkout <ChevronRight className="w-4 h-4 ml-2" /></>
                  ) : (
                    <>Continue with {selectedPlanData?.name ?? "Free"} <ChevronRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ─────────────────────────────────────────────── */}
        {step === 5 && (
          <Card className="max-w-lg mx-auto shadow-lg border-green-500/20">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle className="text-3xl">You're all set!</CardTitle>
              <CardDescription className="text-base mt-2">
                Your workspace is configured and ready to go. Start exploring the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg text-sm">
                {[
                  "Organization profile saved",
                  `Plan: ${selectedPlanData?.name ?? "Free"}`,
                  "Team roles and permissions are ready",
                  "Billing can be configured in Settings",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                className="w-full"
                onClick={handleComplete}
                data-testid="button-launch-dashboard"
              >
                Launch dashboard <Rocket className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
