import {
  setAuthTokenGetter,
  setCustomHeadersGetter,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";

/**
 * Call once at app startup to configure the generated API client:
 * – injects `Authorization: Bearer <token>` from the auth store
 * – injects `X-Tenant-ID` from the active tenant in the auth store
 */
export function initApiConfig(): void {
  setAuthTokenGetter(() => useAuthStore.getState().token);

  setCustomHeadersGetter(() => {
    const { activeTenantId } = useAuthStore.getState();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (activeTenantId) {
      headers["X-Tenant-ID"] = activeTenantId;
    }
    return headers;
  });
}
