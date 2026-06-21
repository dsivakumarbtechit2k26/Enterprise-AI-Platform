import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

export default function ImpersonateCallbackPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const setToken  = useAuthStore((s) => s.setToken);

  useEffect(() => {
    const token      = params.get("token");
    const tenantName = params.get("tenant_name") ?? "";
    const userName   = params.get("user_name")   ?? "";

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    // Store the token so useGetMe can hydrate the user
    setToken(token);

    // Mark this as an impersonation session (shown as a banner in AppShell)
    sessionStorage.setItem(
      "impersonating",
      JSON.stringify({ tenantName, userName, startedAt: new Date().toISOString() }),
    );

    navigate("/", { replace: true });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
