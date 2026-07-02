"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoucherFeedback } from "@/modules/vouchers/utils/voucher-feedback-utils";
import {
  voucherError,
  voucherErrorFromUnknown,
  voucherInfo,
  voucherSuccess,
  voucherWarning,
} from "@/modules/vouchers/utils/voucher-feedback-utils";

export function useVoucherFeedback() {
  const [feedback, setFeedback] = useState<VoucherFeedback | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const showError = useCallback((message: string) => {
    setFeedback(voucherError(message));
  }, []);

  const showSuccess = useCallback((message: string) => {
    setFeedback(voucherSuccess(message));
  }, []);

  const showWarning = useCallback((message: string) => {
    setFeedback(voucherWarning(message));
  }, []);

  const showInfo = useCallback((message: string) => {
    setFeedback(voucherInfo(message));
  }, []);

  const showFromError = useCallback((error: unknown) => {
    setFeedback(voucherErrorFromUnknown(error));
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!feedback || feedback.type === "success") return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [feedback]);

  return {
    feedback,
    feedbackRef,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showFromError,
    clearFeedback,
  };
}
