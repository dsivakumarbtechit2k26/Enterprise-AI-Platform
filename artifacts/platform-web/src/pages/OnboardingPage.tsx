import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useListPlans, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Rocket, Building2 } from "lucide-react";
import { useState } from "react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { tenant } = useAuthStore();
  const { data: plans } = useListPlans();
  const [step, setStep] = useState(1);

  const handleComplete = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-center gap-4 text-sm font-medium text-muted-foreground">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? "border-primary bg-primary/10" : "border-muted"}`}>1</div>
            Welcome
          </div>
          <div className="w-12 h-px bg-border"></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? "border-primary bg-primary/10" : "border-muted"}`}>2</div>
            Choose Plan
          </div>
        </div>

        {step === 1 && (
          <Card className="max-w-md mx-auto shadow-lg border-primary/20">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl">Welcome to {tenant?.name || "Platform"}</CardTitle>
              <CardDescription className="text-base mt-2">
                Your workspace is ready. Let's set up your subscription to unlock all features.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4 bg-muted/50 p-4 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Workspace created successfully</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Admin account secured</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Default roles and permissions provisioned</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full text-lg" onClick={() => setStep(2)} data-testid="button-next-step">
                Continue to Plans
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-tight">Select your plan</h1>
              <p className="text-muted-foreground mt-2">Choose the right tier for your organization's needs.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {plans?.data?.map((plan) => (
                <Card key={plan.key} className={`flex flex-col relative ${plan.key === 'pro' ? 'border-primary shadow-md scale-105 z-10' : ''}`}>
                  {plan.key === 'pro' && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Recommended
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
                    <Button 
                      variant={plan.key === 'pro' ? 'default' : 'outline'} 
                      className="w-full" 
                      onClick={handleComplete}
                      data-testid={`button-select-plan-${plan.key}`}
                    >
                      Start with {plan.name}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="text-center pt-8">
              <Button variant="ghost" onClick={handleComplete} data-testid="button-skip-plans">
                Skip for now and continue to dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
