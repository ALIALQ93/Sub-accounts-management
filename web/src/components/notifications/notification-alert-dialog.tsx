"use client";

import { useEffect } from "react";
import type { AlertNotification } from "@/components/notifications/notification-types";
import { NOTIFICATION_META } from "@/components/notifications/notification-types";

interface NotificationAlertDialogProps {
  alert: AlertNotification | null;
  onDismiss: () => void;
}

export function NotificationAlertDialog({
  alert,
  onDismiss,
}: NotificationAlertDialogProps) {
  useEffect(() => {
    if (!alert) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [alert, onDismiss]);

  if (!alert) return null;

  const meta = NOTIFICATION_META[alert.type];
  const isCritical = alert.type === "error" || alert.type === "warning";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="notification-alert-title"
      aria-describedby="notification-alert-message"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--brand-navy)]/50 backdrop-blur-sm animate-[overlay-in_0.2s_ease-out]"
        aria-label="إغلاق"
        onClick={onDismiss}
      />
      <div
        className={`relative z-10 w-full max-w-md animate-[dialog-in_0.24s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border-2 p-5 shadow-xl ${meta.accent}`}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={meta.iconPath} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="notification-alert-title"
              className="text-lg font-bold leading-snug"
            >
              {alert.title}
            </h2>
            <p
              id="notification-alert-message"
              className="mt-2 text-sm leading-relaxed opacity-95"
            >
              {alert.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
              isCritical
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-current/20 bg-white/80 hover:bg-white"
            }`}
          >
            حسناً
          </button>
        </div>
      </div>
    </div>
  );
}
