import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Zap, ArrowRight } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirmation: z.string(),
  tenant_name: z.string().optional(),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords do not match",
  path: ["password_confirmation"],
});

type RegisterValues = z.infer<typeof registerSchema>;

const REGISTER_FIELDS = ["name", "email", "password", "password_confirmation", "tenant_name"] as const;

function applyServerErrors(
  err: unknown,
  setError: (field: typeof REGISTER_FIELDS[number], opts: { message: string }) => void,
  toast: ReturnType<typeof useToast>["toast"],
) {
  const payload = (err as { data?: unknown })?.data ?? err;
  const res = payload as { errors?: Record<string, string[]>; message?: string };
  if (res?.errors && typeof res.errors === "object") {
    let hasFieldError = false;
    for (const [field, messages] of Object.entries(res.errors)) {
      if ((REGISTER_FIELDS as readonly string[]).includes(field)) {
        setError(field as typeof REGISTER_FIELDS[number], { message: messages[0] });
        hasFieldError = true;
      }
    }
    if (!hasFieldError) {
      toast({ title: "Registration failed", description: res.message || "An error occurred", variant: "destructive" });
    }
  } else {
    toast({ title: "Registration failed", description: res?.message || "An error occurred during registration", variant: "destructive" });
  }
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", password_confirmation: "", tenant_name: "" },
  });

  const onSubmit = (data: RegisterValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        if (res.token && res.user) {
          setAuth({ token: res.token, user: res.user, tenant: res.tenant });
          navigate("/onboarding");
        }
      },
      onError: (err) => applyServerErrors(err, form.setError, toast),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">Enterprise Platform</span>
        </div>

        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your organization</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your workspace and invite your team</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" autoComplete="name" className="h-10 bg-background border-border" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tenant_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Organization Name <span className="normal-case text-muted-foreground/60">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" autoComplete="organization" className="h-10 bg-background border-border" {...field} data-testid="input-tenant" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Email</FormLabel>
                      <FormControl>
                        <Input placeholder="jane@company.com" autoComplete="email" className="h-10 bg-background border-border" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" className="h-10 bg-background border-border" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password_confirmation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" className="h-10 bg-background border-border" {...field} data-testid="input-password-confirm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-10 font-semibold mt-2" disabled={registerMutation.isPending} data-testid="button-submit">
                {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Create account
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
