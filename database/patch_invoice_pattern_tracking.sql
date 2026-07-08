-- =============================================================================
-- patch_invoice_pattern_tracking.sql (#35)
-- =============================================================================
-- خيارات نمط الفاتورة: إظهار تاريخ الصلاحية والرقم التسلسلي على الأسطر.
-- الإجبار يبقى من بطاقة المادة؛ القيم تُدخل في سطر الفاتورة.
-- =============================================================================

alter table public.invoice_patterns
  add column if not exists track_expiry_on_lines boolean not null default true,
  add column if not exists track_serial_on_lines boolean not null default true;

comment on column public.invoice_patterns.track_expiry_on_lines is
  'إظهار عمود تاريخ انتهاء الصلاحية على أسطر المواد (عند تتبع المادة)';
comment on column public.invoice_patterns.track_serial_on_lines is
  'إظهار عمود الرقم التسلسلي على أسطر المواد (عند تتبع المادة)';
