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
import { Building2, ArrowRight, Loader2 } from "lucide-react";

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

/** Map Laravel 422 validation errors onto react-hook-form fields.
 *  The generated API client throws ApiError; the response body lives in err.data. */
function applyServerErrors(
  err: unknown,
  setError: (field: typeof REGISTER_FIELDS[number], opts: { message: string }) => void,
  toast: ReturnType<typeof useToast>["toast"],
) {
  // ApiError wraps the response body in .data; fall back for plain error objects.
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your organization</h1>
          <p className="text-sm text-muted-foreground">Set up your workspace and invite your team</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" autoComplete="name" {...field} data-testid="input-name" />
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
                  <FormLabel>Work Email</FormLabel>
                  <FormControl>
                    <Input placeholder="jane@company.com" autoComplete="email" {...field} data-testid="input-email" />
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
                  <FormLabel>Organization Name <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" autoComplete="organization" {...field} data-testid="input-tenant" />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} data-testid="input-password" />
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} data-testid="input-password-confirm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-submit">
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create account <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
