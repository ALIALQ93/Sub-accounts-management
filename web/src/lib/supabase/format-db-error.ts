/**
 * يحوّل رسائل PostgreSQL/Supabase الشائعة إلى نص عربي أوضح للمستخدم.
 */
export function formatDbError(message: string | null | undefined): string {
  const raw = (message ?? "").trim();
  if (!raw) return "حدث خطأ غير متوقع من قاعدة البيانات.";

  const periodClosed = raw.match(
    /Accounting period\s+(.+?)\s+\((.+?)\)\s+is closed for date\s+(.+?)\./i,
  );
  if (periodClosed) {
    const [, code, name, date] = periodClosed;
    return `الفترة المحاسبية ${code} (${name}) مغلقة — لا يمكن الترحيل في تاريخ ${date}. راجع إعدادات الفترات المحاسبية.`;
  }

  if (/configure inventory_method before stock adjustment/i.test(raw)) {
    return "لم تُضبط طريقة الجرد بعد — راجع إعدادات المواد والمستودعات.";
  }

  if (/no adjustment lines with quantity difference/i.test(raw)) {
    return "لا يوجد فرق كمية في أي سطر — راجع الكميات الفعلية.";
  }

  if (/adjustment value is zero/i.test(raw)) {
    return "قيمة التسوية صفر لأحد الأسطر — تحقق من التكلفة أو الكمية.";
  }

  if (/Parent account has journal entries and cannot have child accounts/i.test(raw)) {
    return "لا يمكن إضافة فرع — الحساب الأب عليه حركة محاسبية. أزل الحركات أولاً أو اختر حساباً آخر.";
  }

  if (/Cannot change postable account to parent while it has journal entries/i.test(raw)) {
    return "لا يمكن تحويل الحساب إلى «حساب أب» — عليه حركة محاسبية مسجّلة.";
  }

  if (/Allocation total \(([\d.]+)\) exceeds original amount \(([\d.]+)\).*Remaining open: ([\d.]+)/i.test(raw)) {
    const m = raw.match(
      /Allocation total \(([\d.]+)\) exceeds original amount \(([\d.]+)\).*Remaining open: ([\d.]+)/i,
    );
    if (m) {
      return `مجموع التخصيصات (${m[1]}) يتجاوز مبلغ الحركة الأصلي (${m[2]}). المتبقي المفتوح: ${m[3]}.`;
    }
  }

  if (/Voucher must be approved before posting/i.test(raw)) {
    return "يجب اعتماد السند قبل الترحيل — لا يمكن الترحيل من مسودة مباشرة.";
  }

  if (/Only posted vouchers can be reversed/i.test(raw)) {
    return "يمكن عكس السندات المرحلة فقط.";
  }

  if (/Voucher is already cancelled/i.test(raw)) {
    return "السند مُلغى مسبقاً ولا يمكن عكسه.";
  }

  if (/Cannot reverse a reversal voucher/i.test(raw)) {
    return "لا يمكن عكس سند عكسي — استخدم السند الأصلي إن كان لا يزال مرحّلاً.";
  }

  if (/Cannot change warehouse branch after inventory movements exist/i.test(raw)) {
    return "لا يمكن تغيير فرع المستودع بعد تسجيل حركات مخزنية عليه.";
  }

  if (/Circular material category hierarchy is not allowed/i.test(raw)) {
    return "لا يمكن جعل التصنيف أباً لأحد أسلافه — تسلسل دائري غير مسموح.";
  }

  if (/Material category cannot be parent of itself/i.test(raw)) {
    return "لا يمكن أن يكون التصنيف أباً لنفسه.";
  }

  if (/requires expiry date on inbound/i.test(raw)) {
    return "تاريخ انتهاء الصلاحية مطلوب عند الإدخال — أدخله في سطر الفاتورة حسب إعداد بطاقة المادة.";
  }

  if (/requires expiry date on outbound/i.test(raw)) {
    return "تاريخ انتهاء الصلاحية مطلوب عند الإخراج — أدخله في سطر الفاتورة حسب إعداد بطاقة المادة.";
  }

  if (/requires serial number on inbound/i.test(raw)) {
    return "الرقم التسلسلي مطلوب لهذه المادة عند الإدخال — راجع إعدادات بطاقة المادة.";
  }

  if (/requires serial number on outbound/i.test(raw)) {
    return "الرقم التسلسلي مطلوب لهذه المادة عند الإخراج — راجع إعدادات بطاقة المادة.";
  }

  if (/discount_amount cannot exceed line gross amount/i.test(raw)) {
    return "مبلغ الخصم لا يمكن أن يتجاوز إجمالي السطر.";
  }

  if (/Line net amount cannot be negative after discount\/extra/i.test(raw)) {
    return "صافي السطر سالب بعد الخصم والإضافي — راجع القيم.";
  }

  if (/Line discount requires discount_account_id/i.test(raw)) {
    return "حساب الخصم مطلوب — حدّده في الفاتورة أو في نمط الفاتورة.";
  }

  if (/Line extra requires extra_account_id/i.test(raw)) {
    return "حساب الإضافي مطلوب — حدّده في الفاتورة أو في نمط الفاتورة.";
  }

  if (/Insufficient lot stock for material/i.test(raw)) {
    const m = raw.match(
      /Insufficient lot stock for material (.+?) in warehouse (.+?)\. Expiry: (.+?), serial: (.+?), available: ([\d.]+), requested: ([\d.]+)/i,
    );
    if (m) {
      return `رصيد الدفعة غير كافٍ — المادة ${m[1]} / المستودع ${m[2]}: صلاحية ${m[3]}، تسلسلي ${m[4]} — المتاح ${m[5]} والمطلوب ${m[6]}.`;
    }
    return "رصيد الدفعة (صلاحية/تسلسلي) غير كافٍ — راجع الاختيار من المخزون المتاح.";
  }

  if (/Insufficient stock for material/i.test(raw)) {
    const m = raw.match(
      /Insufficient stock for material (.+?) in warehouse (.+?)\. Available: ([\d.]+), requested: ([\d.]+)/i,
    );
    if (m) {
      return `الرصيد غير كافٍ — المادة ${m[1]} في المستودع ${m[2]}: المتاح ${m[3]} والمطلوب ${m[4]}.`;
    }
    return "الرصيد غير كافٍ لإتمام حركة الإخراج — راجع الكميات والمستودع.";
  }

  if (/Invoice settlement vouchers cannot be reversed automatically/i.test(raw)) {
    return "لا يمكن عكس سند إغلاق الحركات تلقائياً — راجع إعداد قاعدة البيانات.";
  }

  return raw;
}

export function errorFromSupabase(
  error: { message?: string | null } | null,
  fallback = "حدث خطأ غير متوقع من قاعدة البيانات.",
): Error {
  if (!error) return new Error(fallback);
  return new Error(formatDbError(error.message) || fallback);
}
