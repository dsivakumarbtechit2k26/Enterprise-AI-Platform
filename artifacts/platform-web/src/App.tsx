import { Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute, GuestRoute } from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { initApiConfig } from "@/lib/apiConfig";
import { Loader2 } from "lucide-react";

initApiConfig();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      errorElement: <RouteErrorBoundary />,
      lazy: async () => {
        const { RootLayout } = await import("@/layouts/RootLayout");
        return { Component: RootLayout };
      },
      children: [
        // ── Guest-only routes ───────────────────────────────────────────────
        {
          element: <GuestRoute />,
          children: [
            {
              path: "login",
              lazy: async () => {
                const { default: Page } = await import("@/pages/auth/LoginPage");
                return { Component: Page };
              },
            },
            {
              path: "register",
              lazy: async () => {
                const { default: Page } = await import("@/pages/auth/RegisterPage");
                return { Component: Page };
              },
            },
            {
              path: "forgot-password",
              lazy: async () => {
                const { default: Page } = await import("@/pages/auth/ForgotPasswordPage");
                return { Component: Page };
              },
            },
            {
              path: "reset-password",
              lazy: async () => {
                const { default: Page } = await import("@/pages/auth/ResetPasswordPage");
                return { Component: Page };
              },
            },
            {
              path: "mfa",
              lazy: async () => {
                const { default: Page } = await import("@/pages/auth/MfaPage");
                return { Component: Page };
              },
            },
          ],
        },

        // ── OAuth callback (accessible regardless of auth state) ────────────
        {
          path: "auth/callback",
          lazy: async () => {
            const { default: Page } = await import("@/pages/auth/OAuthCallbackPage");
            return { Component: Page };
          },
        },

        // ── Protected routes ────────────────────────────────────────────────
        {
          element: <ProtectedRoute />,
          children: [
            {
              path: "onboarding",
              lazy: async () => {
                const { default: Page } = await import("@/pages/OnboardingPage");
                return { Component: Page };
              },
            },
            {
              path: "/",
              lazy: async () => {
                const { AppShell } = await import("@/layouts/AppShell");
                return { Component: AppShell };
              },
              errorElement: <RouteErrorBoundary />,
              children: [
                {
                  index: true,
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/DashboardPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "settings",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/settings/ProfilePage");
                    return { Component: Page };
                  },
                },
                {
                  path: "settings/profile",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/settings/ProfilePage");
                    return { Component: Page };
                  },
                },
                {
                  path: "settings/security",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/settings/SecurityPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "settings/billing",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/settings/BillingPage");
                    return { Component: Page };
                  },
                },
                // RBAC routes — require roles.view permission
                {
                  element: <ProtectedRoute requiredPermission="roles.view" />,
                  children: [
                    {
                      path: "roles",
                      lazy: async () => {
                        const { default: Page } = await import("@/pages/RolesPage");
                        return { Component: Page };
                      },
                    },
                    {
                      path: "roles/:roleId",
                      lazy: async () => {
                        const { default: Page } = await import("@/pages/RoleDetailPage");
                        return { Component: Page };
                      },
                    },
                  ],
                },
                {
                  element: <ProtectedRoute requiredPermission="permissions.view" />,
                  children: [
                    {
                      path: "permissions",
                      lazy: async () => {
                        const { default: Page } = await import("@/pages/PermissionsPage");
                        return { Component: Page };
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ── Admin routes — require platform.admin permission ─────────────────
        {
          element: <ProtectedRoute requiredPermission="platform.admin" redirectTo="/403" />,
          children: [
            {
              path: "admin",
              lazy: async () => {
                const { AdminShell } = await import("@/layouts/AdminShell");
                return { Component: AdminShell };
              },
              errorElement: <RouteErrorBoundary />,
              children: [
                {
                  index: true,
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminDashboard");
                    return { Component: Page };
                  },
                },
                {
                  path: "tenants",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminTenantsPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "tenants/:tenantId",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminTenantDetailPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "plans",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminPlansPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "users",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminUsersPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "audit-logs",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminAuditLogPage");
                    return { Component: Page };
                  },
                },
                {
                  path: "settings",
                  lazy: async () => {
                    const { default: Page } = await import("@/pages/admin/AdminSettingsPage");
                    return { Component: Page };
                  },
                },
              ],
            },
          ],
        },

        // ── Impersonate callback (set token + redirect to /) ─────────────
        {
          path: "impersonate",
          lazy: async () => {
            const { default: Page } = await import("@/pages/auth/ImpersonateCallbackPage");
            return { Component: Page };
          },
        },

        // ── Error pages ─────────────────────────────────────────────────────
        {
          path: "403",
          lazy: async () => {
            const { default: Page } = await import("@/pages/ForbiddenPage");
            return { Component: Page };
          },
        },
        {
          path: "*",
          lazy: async () => {
            const { default: Page } = await import("@/pages/not-found");
            return { Component: Page };
          },
        },
      ],
    },
  ],
  { basename: base || "/" },
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={<PageLoader />}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
