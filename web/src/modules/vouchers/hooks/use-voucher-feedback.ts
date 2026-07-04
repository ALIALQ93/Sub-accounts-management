"use client";

import { useCallback } from "react";
import { useNotifications } from "@/components/notifications";
import {
  formatVoucherError,
  voucherError,
  voucherErrorFromUnknown,
  voucherInfo,
  voucherSuccess,
  voucherWarning,
} from "@/modules/vouchers/utils/voucher-feedback-utils";

export function useVoucherFeedback() {
  const {
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    dismissAlert,
  } = useNotifications();

  const showError = useCallback(
    (message: string) => {
      notify(voucherError(message));
    },
    [notify],
  );

  const showSuccess = useCallback(
    (message: string) => {
      notify(voucherSuccess(message));
    },
    [notify],
  );

  const showWarning = useCallback(
    (message: string) => {
      notify(voucherWarning(message));
    },
    [notify],
  );

  const showInfo = useCallback(
    (message: string) => {
      notify(voucherInfo(message));
    },
    [notify],
  );

  const showFromError = useCallback(
    (error: unknown) => {
      notify(voucherErrorFromUnknown(error));
    },
    [notify],
  );

  const clearFeedback = useCallback(() => {
    dismissAlert();
  }, [dismissAlert]);

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showFromError,
    clearFeedback,
    formatError: formatVoucherError,
  };
}
