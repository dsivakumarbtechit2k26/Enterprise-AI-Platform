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
import { KeyRound, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

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
      onSuccess: () => {
        setSuccess(true);
      },
      onError: (err) => {
        toast({
          title: "Request failed",
          description: err.message || "Could not send reset link",
          variant: "destructive",
        });
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 space-y-6 text-center">
          <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, we've sent instructions to reset your password.
          </p>
          <div className="pt-4">
            <Button asChild variant="outline" className="w-full" data-testid="button-back-login">
              <Link to="/login">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@company.com" {...field} data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={forgotMutation.isPending} data-testid="button-submit">
              {forgotMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send reset link
            </Button>
          </form>
        </Form>

        <div className="text-center pt-4">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground" data-testid="link-back-login">
            <Link to="/login">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
