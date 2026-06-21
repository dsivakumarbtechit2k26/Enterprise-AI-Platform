import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute, GuestRoute } from "@/components/ProtectedRoute";
import { initApiConfig } from "@/lib/apiConfig";

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

const router = createBrowserRouter(
  [
    {
      path: "/",
      lazy: async () => {
        const { RootLayout } = await import("@/layouts/RootLayout");
        return { Component: RootLayout };
      },
      children: [
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
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
