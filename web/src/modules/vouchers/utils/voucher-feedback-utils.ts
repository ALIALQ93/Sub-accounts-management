import { ApiError } from "@/modules/vouchers/services/voucher-api";

export type VoucherFeedbackType = "success" | "error" | "warning" | "info";

export interface VoucherFeedback {
  type: VoucherFeedbackType;
  message: string;
}

const ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/Posted voucher cannot be modified/i, "السند مرحّل ولا يمكن تعديله. يتطلب صلاحية مدير النظام."],
  [/Cannot change status of a posted voucher/i, "لا يمكن تغيير حالة سند مرحّل مباشرة."],
  [/Posted voucher lines cannot be changed/i, "لا يمكن تعديل أسطر سند مرحّل."],
  [/Posted voucher cannot be deleted/i, "لا يمكن حذف سند مرحّل مباشرة — استخدم زر الحذف من القائمة إن كانت لديك صلاحية حذف."],
  [/Posted voucher lines cannot be deleted/i, "لا يمكن حذف أسطر سند مرحّل."],
  [/Permission denied: vouchers\.delete required/i, "ليس لديك صلاحية حذف السندات."],
  [/Voucher not found/i, "السند غير موجود."],
  [/Cancelled voucher cannot be deleted/i, "لا يمكن حذف سند ملغى."],
  [
    /Cannot delete voucher: journal lines are referenced by other voucher allocations/i,
    "تعذّر الحذف: حركات هذا السند مُخصَّصة في سندات أخرى. أزل التخصيصات أولاً.",
  ],
  [/Posted voucher allocations cannot be changed/i, "لا يمكن تعديل تخصيصات سند مرحّل."],
  [/unbalanced voucher/i, "السند غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن."],
  [/Cannot post empty voucher/i, "لا يمكن ترحيل سند بدون أسطر."],
  [/Invoice settlement voucher requires allocation/i, "سند إغلاق الحركات يتطلب تخصيصات للفواتير."],
  [/cost centers must balance/i, "مراكز الكلفة غير متوازنة في سند التصفية."],
  [/Settlement voucher lines require a cost center/i, "أسطر سند التصفية تتطلب مركز كلفة."],
  [/Voucher posting is allowed only on leaf/i, "الترحيل مسموح فقط على حسابات قابلة للترحيل (ورقة)."],
  [/inactive accounts/i, "أحد الحسابات المستخدمة غير نشط."],
  [/duplicate key|already exists/i, "رقم أو بيانات مكررة — تحقق من رقم السند."],
  [/permission denied|row-level security/i, "ليس لديك صلاحية لتنفيذ هذا الإجراء."],
  [/Only administrators can sync/i, "تحديث قيد السند المرحّل يتطلب مدير النظام."],
  [/Cannot sync unbalanced/i, "تعذّر تحديث القيد: السند غير متوازن."],
  [/Referenced customer must be active/i, "العميل المرتبط غير نشط."],
  [/Referenced vendor must be active/i, "المورد المرتبط غير نشط."],
  [/Invoice settlement voucher requires a customer or vendor/i, "وضع إغلاق الحركات يتطلب اختيار عميل أو مورد."],
  [/JSON object requested, multiple \(or no\) rows returned/i, "السند غير موجود أو لم يُعثر على سجل مطابق."],
  [/PGRST116/i, "السند غير موجود أو لم يُعثر على سجل مطابق."],
  [/invalid input syntax for type uuid/i, "معرّف غير صالح في بيانات السند."],
  [/JWT expired|session/i, "انتهت الجلسة. سجّل الدخول مجدداً."],
];

export function translateVoucherErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "حدث خطأ غير متوقع.";

  for (const [pattern, arabic] of ERROR_TRANSLATIONS) {
    if (pattern.test(trimmed)) return arabic;
  }

  return trimmed;
}

export function formatVoucherError(error: unknown): string {
  if (error instanceof ApiError) {
    return translateVoucherErrorMessage(error.message);
  }
  if (error instanceof Error) {
    return translateVoucherErrorMessage(error.message);
  }
  return "حدث خطأ غير متوقع.";
}

export function voucherFeedback(
  type: VoucherFeedbackType,
  message: string,
): VoucherFeedback {
  return { type, message };
}

export function voucherError(message: string): VoucherFeedback {
  return voucherFeedback("error", message);
}

export function voucherSuccess(message: string): VoucherFeedback {
  return voucherFeedback("success", message);
}

export function voucherWarning(message: string): VoucherFeedback {
  return voucherFeedback("warning", message);
}

export function voucherInfo(message: string): VoucherFeedback {
  return voucherFeedback("info", message);
}

export function voucherErrorFromUnknown(error: unknown): VoucherFeedback {
  return voucherError(formatVoucherError(error));
}
