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

  if (/Invoice settlement vouchers cannot be reversed automatically/i.test(raw)) {
    return "لا يمكن عكس سند إغلاق حركات/فواتير تلقائياً — التخصيصات المرتبطة لن تُعاد لفتح الحركات. أنشئ سنداً عكسياً يدوياً أو تواصل مع المسؤول.";
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
