-- =============================================================================
-- scenarios_inventory_cost_policy.sql — سيناريوهات تحقق يدوية (لا تُشغَّل تلقائياً)
-- =============================================================================
-- بعد تطبيق patch_inventory_cost_policy.sql اختبر على قاعدتين (أو إعدادين):
--   A) inventory_method = perpetual
--   B) inventory_method = periodic
--
-- 1) بيع: ترحيل بيع بسعر بيع ≠ تكلفة المخزن
--    توقع: unit_cost على الحركة = متوسط المخزن (ليس سعر البيع)
--    مستمر: قيد COGS؛ دوري: بلا قيد COGS
--
-- 2) مرتجع مشتريات: إخراج يؤثر على قيمة المخزون (reverse_inbound)
--
-- 3) تفكيك allocate_from_parent: مجموع تكلفة produce ≈ تكلفة consume
--
-- 4) تفكيك components_at_current_cost: فرق على حساب التكلفة عند اختلاف المتوسطات
--
-- 5) تسوية سريعة عجز/فائض: unit_cost = متوسط المستودع لكلا الاتجاهين
--
-- 6) فاتورة inventory_scrap / shortage / surplus بنفس مرجع المتوسط
--
-- 7) مناقلة إدخال + أسطر حسابات إضافية مدينة:
--    freight_affects_material_cost=true → ارتفاع total_cost على transfer_in
--    مستمر: قيود رسملة مخزون إضافية متوازنة
--
-- دوال مساعدة للتحقق:
--   select * from public.invoice_kind_cost_impact('sale');           -- consume_only
--   select * from public.invoice_kind_cost_impact('return_purchase'); -- reverse_inbound
--   select public.invoice_kind_expected_direction('inventory_surplus'); -- input
-- =============================================================================

select
  k as commercial_kind,
  public.invoice_kind_expected_direction(k) as direction,
  public.invoice_kind_cost_impact(k) as cost_impact
from unnest(array[
  'sale', 'purchase', 'return_sale', 'return_purchase',
  'transfer_out', 'transfer_in',
  'manufacturing', 'disassembly',
  'opening_stock', 'inventory_scrap', 'inventory_shortage', 'inventory_surplus'
]) as k;
