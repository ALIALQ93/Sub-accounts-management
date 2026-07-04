"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotificationAlertDialog } from "@/components/notifications/notification-alert-dialog";
import { NotificationToasts } from "@/components/notifications/notification-toasts";
import type {
  AlertNotification,
  NotificationInput,
  NotificationType,
  ToastNotification,
} from "@/components/notifications/notification-types";
import {
  DEFAULT_TOAST_DURATION_MS,
  NOTIFICATION_META,
  resolveNotificationMode,
} from "@/components/notifications/notification-types";

interface NotificationContextValue {
  notify: (input: NotificationInput) => void;
  notifySuccess: (message: string, title?: string) => void;
  notifyError: (message: string, title?: string) => void;
  notifyWarning: (message: string, title?: string) => void;
  notifyInfo: (message: string, title?: string) => void;
  dismissAlert: () => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_TOASTS = 4;

function createToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [alert, setAlert] = useState<AlertNotification | null>(null);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const pushToast = useCallback(
    (type: NotificationType, message: string, title?: string, durationMs?: number) => {
      const id = createToastId();
      const resolvedDuration = durationMs ?? DEFAULT_TOAST_DURATION_MS;
      const toast: ToastNotification = {
        id,
        type,
        title: title ?? NOTIFICATION_META[type].title,
        message,
        durationMs: resolvedDuration,
      };

      setToasts((current) => [toast, ...current].slice(0, MAX_TOASTS));

      const timer = setTimeout(() => dismissToast(id), resolvedDuration);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const showAlert = useCallback(
    (type: NotificationType, message: string, title?: string) => {
      setAlert({
        type,
        title: title ?? NOTIFICATION_META[type].title,
        message,
      });
    },
    [],
  );

  const notify = useCallback(
    (input: NotificationInput) => {
      const trimmed = input.message.trim();
      if (!trimmed) return;

      const mode = resolveNotificationMode(input.type, input.mode);
      if (mode === "modal") {
        showAlert(input.type, trimmed, input.title);
        return;
      }
      pushToast(input.type, trimmed, input.title, input.durationMs);
    },
    [pushToast, showAlert],
  );

  const notifySuccess = useCallback(
    (message: string, title?: string) => {
      notify({ type: "success", message, title });
    },
    [notify],
  );

  const notifyError = useCallback(
    (message: string, title?: string) => {
      notify({ type: "error", message, title });
    },
    [notify],
  );

  const notifyWarning = useCallback(
    (message: string, title?: string) => {
      notify({ type: "warning", message, title });
    },
    [notify],
  );

  const notifyInfo = useCallback(
    (message: string, title?: string) => {
      notify({ type: "info", message, title });
    },
    [notify],
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      notify,
      notifySuccess,
      notifyError,
      notifyWarning,
      notifyInfo,
      dismissAlert,
      dismissToast,
    }),
    [
      notify,
      notifySuccess,
      notifyError,
      notifyWarning,
      notifyInfo,
      dismissAlert,
      dismissToast,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToasts toasts={toasts} onDismiss={dismissToast} />
      <NotificationAlertDialog alert={alert} onDismiss={dismissAlert} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
