import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Github, Zap } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

async function fetchPublicSettings(): Promise<Record<string, unknown>> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${base}/api/v1/settings/public`);
  if (!res.ok) return {};
  const json = await res.json() as { data?: Record<string, unknown> };
  return json.data ?? {};
}

function applyServerErrors(
  err: unknown,
  setError: (field: keyof LoginValues, opts: { message: string }) => void,
  toast: ReturnType<typeof useToast>["toast"],
) {
  const payload = (err as { data?: unknown })?.data ?? err;
  const res = payload as { errors?: Record<string, string[]>; message?: string };
  if (res?.errors && typeof res.errors === "object") {
    let hasFieldError = false;
    for (const [field, messages] of Object.entries(res.errors)) {
      if (field === "email" || field === "password") {
        setError(field as keyof LoginValues, { message: messages[0] });
        hasFieldError = true;
      }
    }
    if (!hasFieldError) {
      toast({ title: "Login failed", description: res.message || "Invalid credentials", variant: "destructive" });
    }
  } else {
    toast({ title: "Login failed", description: res?.message || "Invalid credentials", variant: "destructive" });
  }
}

function startOAuth(provider: "github" | "google") {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  window.location.href = `${base}/api/v1/auth/social/${provider}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: fetchPublicSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const githubEnabled = Boolean(publicSettings?.["oauth.github.enabled"]);
  const googleEnabled = Boolean(publicSettings?.["oauth.google.enabled"]);
  const showOAuthSection = githubEnabled || googleEnabled;

  const onSubmit = (data: LoginValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        if (res.requires_mfa) {
          navigate("/mfa", { state: { mfa_token: res.mfa_token, mfa_method: res.mfa_method } });
        } else if (res.token && res.user) {
          setAuth({ token: res.token, user: res.user, tenant: res.tenant });
          navigate("/");
        }
      },
      onError: (err) => applyServerErrors(err, form.setError, toast),
    });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left decorative panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-2xl" />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[hsl(var(--sidebar-foreground))]">Enterprise Platform</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-[hsl(var(--sidebar-foreground))] leading-snug mb-4">
            Your entire business,<br />one unified platform.
          </h2>
          <p className="text-sm text-[hsl(var(--sidebar-muted-foreground))] leading-relaxed max-w-sm">
            Build any module, manage any workflow, and run any business process — all without writing a single line of code.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-8 relative z-10">
          {[
            { val: "∞", label: "Custom modules" },
            { val: "100%", label: "No-code" },
            { val: "Multi", label: "Tenant ready" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold text-[hsl(var(--sidebar-foreground))]">{s.val}</p>
              <p className="text-xs text-[hsl(var(--sidebar-muted-foreground))]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">Enterprise Platform</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="you@company.com"
                        autoComplete="email"
                        className="h-10 bg-card border-border focus:border-primary"
                        {...field}
                        data-testid="input-email"
                      />
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</FormLabel>
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline" data-testid="link-forgot-password">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        className="h-10 bg-card border-border focus:border-primary"
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-10 font-semibold mt-2"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>

          {showOAuthSection && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">or continue with</span>
                </div>
              </div>
              <div className={`grid gap-3 ${githubEnabled && googleEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                {githubEnabled && (
                  <Button variant="outline" type="button" className="h-10" onClick={() => startOAuth("github")} data-testid="button-github">
                    <Github className="w-4 h-4 mr-2" /> GitHub
                  </Button>
                )}
                {googleEnabled && (
                  <Button variant="outline" type="button" className="h-10" onClick={() => startOAuth("google")} data-testid="button-google">
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </Button>
                )}
              </div>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground mt-8">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
              Create organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
