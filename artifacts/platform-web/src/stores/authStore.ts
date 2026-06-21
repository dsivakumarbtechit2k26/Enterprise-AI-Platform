import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Tenant } from "@workspace/api-client-react";

export interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  activeTenantId: string | null;
  permissions: string[];
  roles: string[];

  setAuth: (params: { token: string; user: User; tenant?: Tenant | null }) => void;
  setMe: (params: { user: User; tenant?: Tenant | null; permissions: string[]; roles: string[] }) => void;
  setActiveTenant: (tenant: Tenant) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tenant: null,
      activeTenantId: null,
      permissions: [],
      roles: [],

      setAuth: ({ token, user, tenant }) =>
        set({
          token,
          user,
          tenant: tenant ?? null,
          activeTenantId: tenant?.id ?? null,
        }),

      setMe: ({ user, tenant, permissions, roles }) =>
        set((s) => ({
          user,
          tenant: tenant ?? s.tenant,
          activeTenantId: tenant?.id ?? s.activeTenantId,
          permissions,
          roles,
        })),

      setActiveTenant: (tenant) =>
        set({ tenant, activeTenantId: tenant.id }),

      clearAuth: () =>
        set({
          token: null,
          user: null,
          tenant: null,
          activeTenantId: null,
          permissions: [],
          roles: [],
        }),

      isAuthenticated: () => Boolean(get().token),

      hasPermission: (permission) => get().permissions.includes(permission),

      hasRole: (role) => get().roles.includes(role),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        tenant: s.tenant,
        activeTenantId: s.activeTenantId,
        permissions: s.permissions,
        roles: s.roles,
      }),
    },
  ),
);
