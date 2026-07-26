import { inventorySettingsApi } from "@/modules/materials/services/inventory-settings-api";

const FOUNDATION_LOCK_MESSAGE =
  "هذا أول ترحيل مخزني فعلي.\n\nسيُقفل إعدادات الجرد والتكلفة نهائياً (طريقة الجرد، نظام التكلفة، وفصل التكلفة) ولا يمكن تغييرها لاحقاً.\n\nهل تريد المتابعة؟";

/**
 * يطلب تأكيداً قبل أول ترحيل مخزني يقفل foundation_locked.
 * يعيد false إن ألغى المستخدم — يجب إيقاف الترحيل دون استدعاء RPC.
 */
export async function confirmInventoryFoundationLock(): Promise<boolean> {
  const settings = await inventorySettingsApi.getSettings();
  if (settings.foundation_locked) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(FOUNDATION_LOCK_MESSAGE);
}

export class FoundationLockCancelledError extends Error {
  constructor() {
    super("تم إلغاء الترحيل — لم تُقفَل إعدادات الجرد.");
    this.name = "FoundationLockCancelledError";
  }
}

/** يستدعى من طبقات الترحيل قبل RPC — يرمي إن ألغى المستخدم. */
export async function assertInventoryFoundationLockConfirmed(): Promise<void> {
  const ok = await confirmInventoryFoundationLock();
  if (!ok) throw new FoundationLockCancelledError();
}
