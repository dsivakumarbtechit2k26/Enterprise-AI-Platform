import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  redirectTo?: string;
  requiredPermission?: string;
  requiredRole?: string;
  /** User must have at least one of these roles (OR logic). */
  requiredRoles?: string[];
}

export function ProtectedRoute({
  redirectTo = "/login",
  requiredPermission,
  requiredRole,
  requiredRoles,
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/403" replace />;
  }

  if (requiredRoles && !requiredRoles.some((r) => hasRole(r))) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

export function GuestRoute({ redirectTo = "/" }: { redirectTo?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
