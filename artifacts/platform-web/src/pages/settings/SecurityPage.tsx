import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Smartphone, Key } from "lucide-react";
import { Link } from "react-router-dom";

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirmation: z.string(),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords do not match",
  path: ["password_confirmation"],
});

export default function SecurityPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const changePasswordMutation = useChangePassword();

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
      onError: (err) => {
        toast({
          title: "Failed to change password",
          description: err.message || "Please check your current password and try again.",
          variant: "destructive"
        });
      }
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
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">Enabled</Badge>
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
                Use an app like Google Authenticator or Authy to generate time-based one-time passwords when you sign in.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button variant={user?.mfa_enabled ? "outline" : "default"}>
            {user?.mfa_enabled ? "Manage MFA" : "Enable Two-Factor Auth"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>
            Update your password associated with your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <FormField
                control={form.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
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
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
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
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
    </div>
  );
}
