import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

export default function ImpersonateCallbackPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const setToken  = useAuthStore((s) => s.setToken);

  useEffect(() => {
    const code       = params.get("code");
    const tenantName = params.get("tenant_name") ?? "";
    const userName   = params.get("user_name")   ?? "";

    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    // Exchange the one-time code for a real 15-minute Sanctum token.
    // The raw token is never stored in the URL — only this short-lived exchange code.
    fetch("/api/v1/admin/impersonate/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Exchange failed: ${r.status}`);
        return r.json();
      })
      .then((body) => {
        const token = (body as { data?: { token?: string } }).data?.token;
        if (!token) throw new Error("No token in exchange response");

        // Store token; /me will hydrate user + tenant context on the next render
        setToken(token);

        // Mark this as an impersonation session so the AppShell banner appears
        sessionStorage.setItem(
          "impersonating",
          JSON.stringify({ tenantName, userName, startedAt: new Date().toISOString() }),
        );

        navigate("/", { replace: true });
      })
      .catch(() => {
        navigate("/login", { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Starting impersonation session…</p>
    </div>
  );
}
