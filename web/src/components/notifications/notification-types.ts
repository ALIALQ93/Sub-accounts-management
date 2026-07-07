export type NotificationType = "success" | "error" | "warning" | "info";

export type NotificationMode = "toast" | "modal" | "auto";

export interface NotificationInput {
  type: NotificationType;
  message: string;
  title?: string;
  durationMs?: number;
  mode?: NotificationMode;
}

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  durationMs: number;
}

export interface AlertNotification {
  type: NotificationType;
  title: string;
  message: string;
}

export const NOTIFICATION_META: Record<
  NotificationType,
  { title: string; iconPath: string; accent: string }
> = {
  success: {
    title: "تم بنجاح",
    iconPath: "M20 6L9 17l-5-5",
    accent: "border-emerald-400 bg-emerald-50 text-emerald-950",
  },
  error: {
    title: "خطأ",
    iconPath: "M18 6L6 18M6 6l12 12",
    accent: "border-rose-400 bg-rose-50 text-rose-950",
  },
  warning: {
    title: "تنبيه",
    iconPath: "M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    accent: "border-amber-400 bg-amber-50 text-amber-950",
  },
  info: {
    title: "معلومة",
    iconPath: "M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    accent: "border-blue-300 bg-blue-50 text-blue-950",
  },
};

export function resolveNotificationMode(
  type: NotificationType,
  mode: NotificationMode = "auto",
): "toast" | "modal" {
  if (mode !== "auto") return mode;
  return type === "error" || type === "warning" ? "modal" : "toast";
}

export const DEFAULT_TOAST_DURATION_MS = 5000;
