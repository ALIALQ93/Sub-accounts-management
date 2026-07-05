-- =============================================================================
-- patch_invoice_seeds.sql — أنماط فواتير جاهزة (§12)
-- =============================================================================
-- يتطلب: patch_invoices.sql
-- الحسابات الافتراضية NULL — يُضبط من الواجهة أو الإعداد الأولي
-- =============================================================================

-- مبيعات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  default_payment_terms_days, warehouse_movement, cc_on_goods, cc_on_party,
  sort_order
)
select
  'مبيعات', 'Sales', 'output', 'sale',
  'SAL', 'credit', true, 90, true, true, true, 10
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'sale' and name_ar = 'مبيعات'
);

-- مشتريات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  default_payment_terms_days, warehouse_movement, sort_order
)
select
  'مشتريات', 'Purchases', 'input', 'purchase',
  'PUR', 'credit', true, 60, true, 20
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'purchase' and name_ar = 'مشتريات'
);

-- مناقلة إخراج
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order
)
select
  'مناقلة — إخراج', 'Transfer Out', 'output', 'transfer_out',
  'TRO', true, true, 30
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'transfer_out'
);

-- مناقلة إدخال
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order
)
select
  'مناقلة — إدخال', 'Transfer In', 'input', 'transfer_in',
  'TRI', true, true, 40
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'transfer_in'
);

-- ربط out → in
update public.invoice_patterns out_p
set paired_input_pattern_id = in_p.id
from public.invoice_patterns in_p
where out_p.commercial_kind = 'transfer_out'
  and in_p.commercial_kind = 'transfer_in'
  and out_p.paired_input_pattern_id is null;

-- مرتجع مبيعات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_return,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'مرتجع مبيعات', 'Sales Return', 'input', 'return_sale', true,
  'RSR', true, 50
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'return_sale'
);

-- مرتجع مشتريات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_return,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'مرتجع مشتريات', 'Purchase Return', 'output', 'return_purchase', true,
  'RPR', true, 60
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'return_purchase'
);

-- بضاعة أول المدة
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_opening_stock,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'بضاعة أول المدة', 'Opening Stock', 'input', 'opening_stock', true,
  'OPS', true, 70
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'opening_stock'
);

-- نسخ نقدي (اختيارية)
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  warehouse_movement, cc_on_goods, cc_on_party, sort_order
)
select
  'مبيعات نقدي', 'Cash Sales', 'output', 'sale',
  'SAL-C', 'cash', false, true, true, true, 11
where not exists (
  select 1 from public.invoice_patterns where name_ar = 'مبيعات نقدي'
);

insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  warehouse_movement, sort_order
)
select
  'مشتريات نقدي', 'Cash Purchases', 'input', 'purchase',
  'PUR-C', 'cash', false, true, 21
where not exists (
  select 1 from public.invoice_patterns where name_ar = 'مشتريات نقدي'
);
