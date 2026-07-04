"use client";

import type { ToastNotification } from "@/components/notifications/notification-types";
import { NOTIFICATION_META } from "@/components/notifications/notification-types";

interface NotificationToastsProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function NotificationToasts({ toasts, onDismiss }: NotificationToastsProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 left-4 z-[110] flex w-[min(100vw-2rem,24rem)] flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((toast) => {
        const meta = NOTIFICATION_META[toast.type];
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto animate-[toast-in_0.28s_ease-out] rounded-xl border-2 px-4 py-3 text-sm shadow-lg ${meta.accent}`}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/75 text-sm font-bold"
                aria-hidden
              >
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{toast.title}</p>
                <p className="mt-1 leading-relaxed">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 rounded-md border border-current/15 px-2 py-0.5 text-xs opacity-70 hover:opacity-100"
                aria-label="إغلاق الإشعار"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
