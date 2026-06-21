import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LockKeyhole, Loader2, ArrowRight } from "lucide-react";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirmation: z.string(),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords do not match",
  path: ["password_confirmation"],
});

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const resetMutation = useResetPassword();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  const onSubmit = (data: z.infer<typeof resetSchema>) => {
    resetMutation.mutate({ 
      data: {
        token,
        email,
        password: data.password,
        password_confirmation: data.password_confirmation
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Password reset successful",
          description: "You can now log in with your new password.",
        });
        navigate("/login");
      },
      onError: (err) => {
        toast({
          title: "Reset failed",
          description: err.message || "Could not reset password",
          variant: "destructive",
        });
      }
    });
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 text-center space-y-4">
          <h1 className="text-xl font-bold">Invalid reset link</h1>
          <p className="text-muted-foreground">This password reset link is invalid or has expired.</p>
          <Button onClick={() => navigate("/forgot-password")} data-testid="button-request-new">
            Request new link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <LockKeyhole className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
          <p className="text-sm text-muted-foreground">Create a new, strong password for your account</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} data-testid="input-password" />
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
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} data-testid="input-password-confirm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={resetMutation.isPending} data-testid="button-submit">
              {resetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Reset password <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
