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
  { title: string; icon: string; accent: string }
> = {
  success: {
    title: "تم بنجاح",
    icon: "✓",
    accent: "border-emerald-400 bg-emerald-50 text-emerald-950",
  },
  error: {
    title: "خطأ",
    icon: "✕",
    accent: "border-rose-400 bg-rose-50 text-rose-950",
  },
  warning: {
    title: "تنبيه",
    icon: "!",
    accent: "border-amber-400 bg-amber-50 text-amber-950",
  },
  info: {
    title: "معلومة",
    icon: "i",
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
