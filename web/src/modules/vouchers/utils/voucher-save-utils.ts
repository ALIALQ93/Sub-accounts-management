import type { VoucherStatus } from "@/modules/vouchers/types";

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
  return "تم حفظ السند بنجاح.";
}
