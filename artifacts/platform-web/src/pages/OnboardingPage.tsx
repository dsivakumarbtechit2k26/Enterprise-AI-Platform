import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/authStore";
import { useListPlans } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Building2, Users, Rocket, ChevronRight, ChevronLeft } from "lucide-react";

const TOTAL_STEPS = 4;

const orgSchema = z.object({
  org_name: z.string().min(2, "Organization name must be at least 2 characters"),
  industry: z.string().min(1, "Please select an industry"),
  team_size: z.string().min(1, "Please select a team size"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

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
  { value: "1-10", label: "1–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "201-500", label: "201–500 people" },
  { value: "500+", label: "500+ people" },
];

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
            <div className={`w-10 h-px ${step < current ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { tenant } = useAuthStore();
  const { data: plansData } = useListPlans();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const orgForm = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      org_name: tenant?.name ?? "",
      industry: "",
      team_size: "",
    },
  });

  const handleComplete = () => {
    navigate("/", { replace: true });
  };

  const plans = plansData?.data ?? [];

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

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card className="max-w-lg mx-auto shadow-lg border-primary/20">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl">
                Welcome to {tenant?.name || "Platform"}
              </CardTitle>
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

        {/* Step 2: Organization Details */}
        {step === 2 && (
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
                onSubmit={orgForm.handleSubmit(() => setStep(3))}
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
                              <SelectItem key={ind} value={ind} data-testid={`option-industry-${ind.toLowerCase().replace(/\s/g, "-")}`}>
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
                              <SelectItem key={size.value} value={size.value} data-testid={`option-size-${size.value}`}>
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
                    onClick={() => setStep(1)}
                    data-testid="button-onboarding-back-step2"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" data-testid="button-onboarding-next-step2">
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        )}

        {/* Step 3: Choose Plan */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
              <p className="text-muted-foreground mt-2">
                Pick the right tier for your organization. You can change this anytime.
              </p>
            </div>

            {plans.length > 0 ? (
              <div className={`grid gap-6 ${plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 max-w-2xl mx-auto"}`}>
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.key;
                  const isRecommended = plan.key === "pro";
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
                          <span className="text-4xl font-bold">
                            {plan.price_monthly === 0 ? "Free" : `$${plan.price_monthly}`}
                          </span>
                          {plan.price_monthly > 0 && (
                            <span className="text-muted-foreground">/mo</span>
                          )}
                        </div>
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

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 max-w-2xl mx-auto">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                data-testid="button-onboarding-back-step3"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(4)}
                  data-testid="button-skip-plan"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!selectedPlan}
                  data-testid="button-onboarding-next-step3"
                >
                  Continue with {plans.find((p) => p.key === selectedPlan)?.name ?? "Free"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
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
                  `Plan selected: ${plans.find((p) => p.key === selectedPlan)?.name ?? "Free"}`,
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
