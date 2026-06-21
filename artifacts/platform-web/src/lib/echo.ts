import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore, type Notification as AppNotification } from "@/stores/notificationStore";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

window.Pusher = Pusher;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let echoInstance: Echo<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEcho(): Echo<any> | null {
  return echoInstance;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initEcho(): Echo<any> {
  if (echoInstance) return echoInstance;

  const { token } = useAuthStore.getState();

  echoInstance = new Echo({
    broadcaster: "reverb",
    key: import.meta.env.VITE_REVERB_APP_KEY ?? "app-key",
    wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? "https") === "https",
    enabledTransports: ["ws", "wss"],
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    },
  });

  echoInstance.connector.pusher.connection.bind("connected", () => {
    useNotificationStore.getState().setConnected(true);
  });

  echoInstance.connector.pusher.connection.bind("disconnected", () => {
    useNotificationStore.getState().setConnected(false);
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    useNotificationStore.getState().setConnected(false);
  }
}

export function subscribeToTenantChannel(tenantId: string): void {
  const echo = initEcho();
  const { addNotification } = useNotificationStore.getState();

  echo.private(`tenant.${tenantId}`)
    .listen(".notification", (event: Record<string, unknown>) => {
      addNotification({
        title: String(event.title ?? "Notification"),
        body: String(event.body ?? ""),
        type: (event.type as AppNotification["type"]) ?? "info",
        created_at: new Date().toISOString(),
        data: event as Record<string, unknown>,
      });
    });
}
