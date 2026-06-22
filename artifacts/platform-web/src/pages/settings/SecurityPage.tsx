import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from "react-qr-code";
import {
  getMfaSetup,
  useConfirmMfaSetup,
  useDisableMfa,
  useChangePassword,
  type MfaSetupResponse,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Shield, Smartphone, Key, CheckCircle2, Copy } from "lucide-react";

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: "Passwords do not match",
  path: ["password_confirmation"],
});

type MfaStep = "idle" | "qr" | "verify" | "done";

export default function SecurityPage() {
  const { user, setMe } = useAuthStore();
  const { toast } = useToast();

  const [mfaStep, setMfaStep] = useState<MfaStep>("idle");
  const [mfaFetching, setMfaFetching] = useState(false);
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  const changePasswordMutation = useChangePassword();
  const confirmMfaMutation = useConfirmMfaSetup();
  const disableMfaMutation = useDisableMfa();

  const handleEnableMfa = async () => {
    setMfaFetching(true);
    try {
      const data = await getMfaSetup();
      setSetupData(data);
      setOtpCode("");
      setMfaStep("qr");
    } catch {
      toast({ title: "Could not load MFA setup. Please try again.", variant: "destructive" });
    } finally {
      setMfaFetching(false);
    }
  };

  const handleConfirmSetup = () => {
    if (otpCode.length !== 6) return;
    confirmMfaMutation.mutate({ data: { code: otpCode } }, {
      onSuccess: () => {
        setMfaStep("done");
        const s = useAuthStore.getState();
        setMe({ user: { ...user!, mfa_enabled: true }, tenant: s.tenant, permissions: s.permissions, roles: s.roles });
        toast({ title: "Two-factor authentication enabled", description: "Your account is now more secure." });
      },
      onError: () => {
        toast({ title: "Invalid code", description: "The code you entered is incorrect. Please try again.", variant: "destructive" });
        setOtpCode("");
      },
    });
  };

  const handleDisableMfa = () => {
    disableMfaMutation.mutate(undefined, {
      onSuccess: () => {
        setShowDisableDialog(false);
        const s = useAuthStore.getState();
        setMe({ user: { ...user!, mfa_enabled: false }, tenant: s.tenant, permissions: s.permissions, roles: s.roles });
        toast({ title: "Two-factor authentication disabled", variant: "destructive" });
      },
      onError: () => {
        toast({ title: "Failed to disable MFA. Please try again.", variant: "destructive" });
      },
    });
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      toast({ title: "Secret copied to clipboard" });
    }
  };

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });

  const onSubmit = (data: z.infer<typeof passwordSchema>) => {
    changePasswordMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        form.reset();
      },
      onError: (err: any) => {
        toast({
          title: "Failed to change password",
          description: err?.message || "Please check your current password and try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your password and secure your account with two-factor authentication.
        </p>
      </div>

      {/* ── Two-Factor Authentication ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Two-Factor Authentication
              </CardTitle>
              <CardDescription className="mt-1">
                Add an extra layer of security to your account.
              </CardDescription>
            </div>
            {user?.mfa_enabled ? (
              <Badge className="bg-green-500 hover:bg-green-600">Enabled</Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
            <Smartphone className="w-8 h-8 text-muted-foreground shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-medium">Authenticator App</h3>
              <p className="text-sm text-muted-foreground">
                Use an app like Google Authenticator or Authy to generate time-based
                one-time passwords when you sign in.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          {user?.mfa_enabled ? (
            <Button variant="outline" onClick={() => setShowDisableDialog(true)}>
              Disable Two-Factor Auth
            </Button>
          ) : (
            <Button onClick={handleEnableMfa} disabled={mfaFetching}>
              {mfaFetching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enable Two-Factor Auth
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* ── Change Password ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>Update your password associated with your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <FormField control={form.control} name="current_password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password_confirmation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-2">
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── MFA Setup Dialog — Step 1: QR Code ───────────────────────────────── */}
      <Dialog
        open={mfaStep === "qr" || mfaStep === "verify"}
        onOpenChange={(open) => { if (!open) { setMfaStep("idle"); setOtpCode(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          {mfaStep === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {setupData?.qr_code_url && (
                  <div className="p-4 bg-white rounded-xl border shadow-sm">
                    <QRCode value={setupData.qr_code_url} size={200} />
                  </div>
                )}
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    Can't scan? Enter this key manually:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                    <span className="flex-1 select-all">{setupData?.secret}</span>
                    <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={copySecret}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMfaStep("idle")}>Cancel</Button>
                <Button onClick={() => setMfaStep("verify")}>Next: Enter Code →</Button>
              </DialogFooter>
            </>
          )}

          {mfaStep === "verify" && (
            <>
              <DialogHeader>
                <DialogTitle>Verify Your Authenticator</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-6 py-4">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMfaStep("qr")}>← Back</Button>
                <Button
                  onClick={handleConfirmSetup}
                  disabled={otpCode.length !== 6 || confirmMfaMutation.isPending}
                >
                  {confirmMfaMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirm & Enable
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MFA Enabled Success Dialog ────────────────────────────────────────── */}
      <Dialog open={mfaStep === "done"} onOpenChange={(open) => { if (!open) setMfaStep("idle"); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> MFA Enabled
            </DialogTitle>
            <DialogDescription>
              Two-factor authentication is now active. You'll be asked for a code each time you sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setMfaStep("idle")}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable MFA Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra layer of security from your account.
              You can re-enable it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMfa}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disableMfaMutation.isPending}
            >
              {disableMfaMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Yes, Disable MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
