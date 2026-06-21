import { useAuthStore } from "@/stores/authStore";

const BASE = "/api/v1/admin";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function adminFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { message?: string; detail?: string }).message ??
      (body as { message?: string; detail?: string }).detail ??
      `HTTP ${res.status}`;
    throw new AdminApiError(msg, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Typed response shapes ─────────────────────────────────────────────────────

export interface AdminStats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  suspended_tenants: number;
  new_this_month: number;
  churned_this_month: number;
  mrr_cents: number;
  failed_payments: number;
  total_users: number;
  queued_jobs: number;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trialing";
  plan: string;
  user_count: number;
  stripe_id: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  created_at: string;
}

export interface AdminTenantDetail extends AdminTenant {
  pm_type: string | null;
  pm_last_four: string | null;
  settings: Record<string, unknown> | null;
  users: AdminTenantUser[];
  subscription: AdminSubscription | null;
  updated_at: string;
}

export interface AdminTenantUser {
  id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string | null;
}

export interface AdminSubscription {
  id: number;
  name: string;
  stripe_status: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  tenant_ids: string[];
  tenant_names: string[];
  roles: string[];
  created_at: string;
}

export interface AdminPlan {
  id: number;
  key: string;
  name: string;
  description: string | null;
  price_cents: number;
  interval: string;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
  features: Record<string, string>;
}

export interface AdminAuditLog {
  id: number;
  event: string;
  auditable_type: string | null;
  auditable_id: number | null;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  tenant_id: string | null;
  created_at: string;
}

export interface AdminSetting {
  value: unknown;
  type: string;
  description: string | null;
  is_public: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ImpersonationResult {
  token: string;
  tenant_id: string;
  tenant_name: string;
  user_name: string;
  user_email: string;
  expires_at: string;
}
