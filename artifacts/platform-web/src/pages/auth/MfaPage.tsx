import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useVerifyMfa, useVerifyEmailOtp, useSendEmailOtp } from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldAlert, Loader2, Mail } from "lucide-react";

const mfaSchema = z.object({
  code: z.string().min(6, "Code must be 6 digits").max(10, "Code is too long"),
});

export default function MfaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  
  const mfaToken = location.state?.mfa_token as string;
  const initialMethod = (location.state?.mfa_method as "totp" | "email_otp") || "totp";
  const [method, setMethod] = useState<"totp" | "email_otp">(initialMethod);
  
  const verifyTotpMutation = useVerifyMfa();
  const verifyEmailMutation = useVerifyEmailOtp();
  const sendEmailMutation = useSendEmailOtp();

  const isPending = verifyTotpMutation.isPending || verifyEmailMutation.isPending;

  const form = useForm<z.infer<typeof mfaSchema>>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { code: "" },
  });

  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = (data: z.infer<typeof mfaSchema>) => {
    const payload = { data: { mfa_token: mfaToken, code: data.code } };
    
    const onSuccess = (res: any) => {
      if (res.token && res.user) {
        setAuth({ token: res.token, user: res.user, tenant: res.tenant });
        navigate("/");
      }
    };
    
    const onError = (err: any) => {
      toast({
        title: "Verification failed",
        description: err.message || "Invalid code",
        variant: "destructive",
      });
      form.setValue("code", "");
    };

    if (method === "totp") {
      verifyTotpMutation.mutate(payload, { onSuccess, onError });
    } else {
      verifyEmailMutation.mutate(payload, { onSuccess, onError });
    }
  };

  const requestEmailOtp = () => {
    sendEmailMutation.mutate(
      { data: { mfa_token: mfaToken } },
      {
        onSuccess: () => {
          setMethod("email_otp");
          toast({
            title: "Email sent",
            description: "Check your inbox for the verification code.",
          });
        },
        onError: (err) => {
          toast({
            title: "Failed to send email",
            description: err.message || "Please try again later.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            {method === "totp" 
              ? "Enter the 6-digit code from your authenticator app." 
              : "Enter the code sent to your email address."}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="000000" 
                      className="text-center text-2xl tracking-[0.5em] font-mono" 
                      maxLength={10}
                      autoFocus
                      {...field} 
                      data-testid="input-mfa-code" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit">
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Verify Identity
            </Button>
          </form>
        </Form>

        {method === "totp" && (
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-4">Can't access your authenticator app?</p>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={requestEmailOtp}
              disabled={sendEmailMutation.isPending}
              data-testid="button-send-email"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send code via email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
