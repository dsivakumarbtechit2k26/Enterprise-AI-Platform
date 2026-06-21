import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;

  addNotification: (n: Omit<Notification, "id" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setConnected: (v: boolean) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,

  addNotification: (n) => {
    const item: Notification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      read: false,
    };
    set((s) => ({
      notifications: [item, ...s.notifications].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    }));
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - (s.notifications.find((n) => n.id === id)?.read ? 0 : 1)),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  setConnected: (connected) => set({ connected }),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
