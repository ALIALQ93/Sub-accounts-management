"use client";

import type { RefObject } from "react";
import type { VoucherFeedback } from "@/modules/vouchers/utils/voucher-feedback-utils";

interface VoucherFormFeedbackProps {
  feedback: VoucherFeedback | null;
  feedbackRef?: RefObject<HTMLDivElement | null>;
  onDismiss?: () => void;
  className?: string;
}

const STYLE: Record<
  VoucherFeedback["type"],
  { box: string; title: string; icon: string }
> = {
  error: {
    box: "border-rose-300 bg-rose-50 text-rose-950",
    title: "خطأ",
    icon: "✕",
  },
  success: {
    box: "border-emerald-300 bg-emerald-50 text-emerald-950",
    title: "تم بنجاح",
    icon: "✓",
  },
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-950",
    title: "تنبيه",
    icon: "!",
  },
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-950",
    title: "معلومة",
    icon: "i",
  },
};

export function VoucherFormFeedback({
  feedback,
  feedbackRef,
  onDismiss,
  className = "",
}: VoucherFormFeedbackProps) {
  if (!feedback?.message) return null;

  const styles = STYLE[feedback.type];
  const isAssertive = feedback.type === "error" || feedback.type === "warning";

  return (
    <div
      ref={feedbackRef}
      role="alert"
      aria-live={isAssertive ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm ${styles.box} ${className}`}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold"
        aria-hidden
      >
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{styles.title}</p>
        <p className="mt-0.5 leading-relaxed">{feedback.message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md border border-current/20 px-2 py-0.5 text-xs opacity-70 hover:opacity-100"
          aria-label="إغلاق الإشعار"
        >
          إغلاق
        </button>
      )}
    </div>
  );
}
