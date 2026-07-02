interface VoucherAdminPostedNoticeProps {
  visible: boolean;
}

export function VoucherAdminPostedNotice({ visible }: VoucherAdminPostedNoticeProps) {
  if (!visible) return null;

  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      وضع مدير النظام: يمكنك تعديل هذا السند المرحّل. سيتم تحديث قيد اليومية المرتبط
      تلقائياً عند الحفظ.
    </p>
  );
}
