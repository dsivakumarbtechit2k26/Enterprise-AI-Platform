import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, CheckCircle2, Zap } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const forgotMutation = useForgotPassword();

  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: z.infer<typeof forgotSchema>) => {
    forgotMutation.mutate({ data }, {
      onSuccess: () => { setSuccess(true); },
      onError: (err) => {
        toast({ title: "Request failed", description: err.message || "Could not send reset link", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">Enterprise Platform</span>
        </div>

        {success ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Check your inbox</h1>
            <p className="text-sm text-muted-foreground mt-2">
              If an account exists for that email, we've sent instructions to reset your password.
            </p>
            <Button asChild variant="outline" className="w-full mt-6 h-10" data-testid="button-back-login">
              <Link to="/login">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send a reset link</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@company.com" className="h-10 bg-background border-border" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-10 font-semibold" disabled={forgotMutation.isPending} data-testid="button-submit">
                    {forgotMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send reset link
                  </Button>
                </form>
              </Form>
            </div>

            <div className="text-center mt-5">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs" data-testid="link-back-login">
                <Link to="/login">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to login
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
