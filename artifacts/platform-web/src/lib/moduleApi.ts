import { useAuthStore } from "@/stores/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleField {
  id: number;
  module_id: number;
  name: string;
  label: string;
  field_type: FieldType;
  options: FieldOptions | null;
  is_required: boolean;
  show_in_list: boolean;
  show_in_form: boolean;
  sort_order: number;
  created_at?: string;
}

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "decimal"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "user_picker"
  | "relation";

export interface FieldOptions {
  choices?: string[];
  module_slug?: string;
  min?: number;
  max?: number;
  prefix?: string;
}

export interface DynamicModule {
  id: number;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
  is_enabled: boolean;
  settings: Record<string, unknown> | null;
  records_count?: number;
  fields?: ModuleField[];
  created_at?: string;
  updated_at?: string;
}

export interface DynamicRecord {
  id: number;
  module_id: number;
  tenant_id: string;
  data: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedRecords {
  data: DynamicRecord[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  module: DynamicModule;
}

export interface ModuleStats {
  total: number;
  this_week: number;
  daily_chart: { date: string; count: number }[];
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ModuleApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message);
    this.name = "ModuleApiError";
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const { token, activeTenantId } = useAuthStore.getState();
  const h: Record<string, string> = {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (activeTenantId) h["X-Tenant-ID"] = activeTenantId;
  return h;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new ModuleApiError(msg, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Admin Module API ──────────────────────────────────────────────────────────

export async function fetchAdminModules(): Promise<{ data: DynamicModule[] }> {
  return apiFetch("/admin/modules");
}

export async function fetchAdminModule(id: number): Promise<{ data: DynamicModule }> {
  return apiFetch(`/admin/modules/${id}`);
}

export async function createModule(payload: {
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  is_enabled?: boolean;
}): Promise<{ data: DynamicModule }> {
  return apiFetch("/admin/modules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  id: number,
  payload: Partial<Pick<DynamicModule, "name" | "icon" | "description" | "is_enabled" | "settings">>,
): Promise<{ data: DynamicModule }> {
  return apiFetch(`/admin/modules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteModule(id: number): Promise<void> {
  return apiFetch(`/admin/modules/${id}`, { method: "DELETE" });
}

export async function toggleModule(id: number): Promise<{ data: { id: number; is_enabled: boolean } }> {
  return apiFetch(`/admin/modules/${id}/toggle`, { method: "PATCH" });
}

// ── Admin Field API ───────────────────────────────────────────────────────────

export async function createField(
  moduleId: number,
  payload: Omit<ModuleField, "id" | "module_id" | "created_at">,
): Promise<{ data: ModuleField }> {
  return apiFetch(`/admin/modules/${moduleId}/fields`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateField(
  moduleId: number,
  fieldId: number,
  payload: Partial<Omit<ModuleField, "id" | "module_id" | "name" | "created_at">>,
): Promise<{ data: ModuleField }> {
  return apiFetch(`/admin/modules/${moduleId}/fields/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteField(moduleId: number, fieldId: number): Promise<void> {
  return apiFetch(`/admin/modules/${moduleId}/fields/${fieldId}`, { method: "DELETE" });
}

export async function reorderFields(moduleId: number, ids: number[]): Promise<void> {
  return apiFetch(`/admin/modules/${moduleId}/fields/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ── Platform Modules (tenant-scoped) ─────────────────────────────────────────

export async function fetchEnabledModules(): Promise<{ data: DynamicModule[] }> {
  return apiFetch("/platform/modules");
}

export async function fetchModuleDetail(slug: string): Promise<{ data: DynamicModule }> {
  return apiFetch(`/platform/modules/${slug}`);
}

// ── Record API ────────────────────────────────────────────────────────────────

export async function fetchRecords(
  slug: string,
  params?: { search?: string; page?: number; per_page?: number; sort_field?: string; sort_dir?: string },
): Promise<PaginatedRecords> {
  const qs = new URLSearchParams();
  if (params?.search)     qs.set("search", params.search);
  if (params?.page)       qs.set("page", String(params.page));
  if (params?.per_page)   qs.set("per_page", String(params.per_page));
  if (params?.sort_field) qs.set("sort_field", params.sort_field);
  if (params?.sort_dir)   qs.set("sort_dir", params.sort_dir);
  const q = qs.toString();
  return apiFetch(`/m/${slug}/records${q ? `?${q}` : ""}`);
}

export async function fetchModuleStats(slug: string): Promise<{ data: ModuleStats }> {
  return apiFetch(`/m/${slug}/stats`);
}

export async function fetchRecord(slug: string, id: number): Promise<{ data: DynamicRecord; module: DynamicModule }> {
  return apiFetch(`/m/${slug}/records/${id}`);
}

export async function createRecord(
  slug: string,
  data: Record<string, unknown>,
): Promise<{ data: DynamicRecord }> {
  return apiFetch(`/m/${slug}/records`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function updateRecord(
  slug: string,
  id: number,
  data: Record<string, unknown>,
): Promise<{ data: DynamicRecord }> {
  return apiFetch(`/m/${slug}/records/${id}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export async function deleteRecord(slug: string, id: number): Promise<void> {
  return apiFetch(`/m/${slug}/records/${id}`, { method: "DELETE" });
}
