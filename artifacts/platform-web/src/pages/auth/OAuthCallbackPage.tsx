import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/**
 * Handles the OAuth redirect from the backend after social authentication.
 *
 * The backend redirects here (GET /auth/callback) with one of:
 *   - ?token=<sanctum_token>           → successful auth, no MFA
 *   - ?mfa_required=1&mfa_token=<tok>  → MFA challenge required
 *   - ?error=<url-encoded message>     → auth failure
 *
 * Token storage: we store the raw token via setToken so AppShell's useGetMe
 * call hydrates the user/tenant/permissions on next render.
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const { toast } = useToast();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token      = searchParams.get("token");
    const error      = searchParams.get("error");
    const mfaRequired = searchParams.get("mfa_required") === "1";
    const mfaToken   = searchParams.get("mfa_token");
    const mfaMethod  = searchParams.get("mfa_method") ?? "totp";

    if (error) {
      toast({
        title: "Sign-in failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    if (mfaRequired && mfaToken) {
      // Redirect to the MFA challenge page with the pending token.
      navigate("/mfa", {
        replace: true,
        state: { mfa_token: mfaToken, mfa_method: mfaMethod },
      });
      return;
    }

    if (!token) {
      toast({
        title: "Sign-in failed",
        description: "No authentication token received from provider.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    // Store token — user/tenant/permissions are fetched by AppShell via /me.
    setToken(token);
    navigate("/", { replace: true });
  }, [searchParams, navigate, setToken, toast]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background"
      data-testid="page-oauth-callback"
    >
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </div>
  );
}
