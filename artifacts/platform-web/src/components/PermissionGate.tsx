import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";

interface PermissionGateProps {
  permission?: string;
  role?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only when the current user has the required permission
 * or role. Shows `fallback` (default: nothing) otherwise.
 */
export function PermissionGate({
  permission,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);

  const allowed =
    (!permission || hasPermission(permission)) &&
    (!role || hasRole(role));

  return allowed ? <>{children}</> : <>{fallback}</>;
}
