import type { VoucherStatus } from "@/modules/vouchers/types";

const SAVE_FEEDBACK_STORAGE_KEY = "voucher-save-feedback";

export function stashVoucherSaveFeedback(message: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SAVE_FEEDBACK_STORAGE_KEY, message);
}

export function consumeVoucherSaveFeedback(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const message = sessionStorage.getItem(SAVE_FEEDBACK_STORAGE_KEY);
  if (message) sessionStorage.removeItem(SAVE_FEEDBACK_STORAGE_KEY);
  return message;
}

export function resolveVoucherSaveStatus(
  currentStatus: VoucherStatus,
  targetStatus: VoucherStatus,
): VoucherStatus {
  if (currentStatus === "posted") return "posted";
  return targetStatus;
}

export function getVoucherSaveFeedback(
  currentStatus: VoucherStatus,
  targetStatus: VoucherStatus,
): string {
  if (currentStatus === "posted") {
    return "تم حفظ التعديلات وتحديث قيد اليومية.";
  }
  if (targetStatus === "approved") {
    return "تم حفظ واعتماد السند.";
  }
  if (targetStatus === "draft") {
    return "تم حفظ المسودة بنجاح.";
  }
  return "تم حفظ السند بنجاح.";
}

export function getDraftSaveRedirectMessage(feedback: string): string {
  return `${feedback} يمكنك متابعة تعديل المسودة من هذه الصفحة.`;
}
