-- =============================================================================
-- ترقية تزايدية — أنواع المواد (semi*) + سياسة صلاحية ناتج التصنيع
-- مرحلة البناء: الأفضل إعادة تشغيل setup_all.sql أو setup_demo_restaurant.sql.
-- هذا الملف للقواعد التجريبية الموجودة دون wipe كامل.
-- =============================================================================

-- 1) أوضاع التجميع
alter table public.materials drop constraint if exists materials_composite_mode_chk;

alter table public.materials
  add constraint materials_composite_mode_chk
  check (
    (
      material_kind = 'normal'
      and composite_mode is null
    )
    or (
      material_kind = 'composite'
      and composite_mode in (
        'kit',
        'semi',
        'semi_disassemblable',
        'finished',
        'disassemblable'
      )
    )
  );

comment on column public.materials.composite_mode is
  'تجميعية: kit|semi|semi_disassemblable|finished|disassemblable — مرحلة × قابلية تفكيك';

-- 2) سياسة صلاحية ناتج التصنيع (لا تُقفَل مع foundation)
alter table public.company_inventory_settings
  add column if not exists manufacturing_produce_expiry_policy varchar(30) not null default 'min_component';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_inventory_settings_mfg_expiry_policy_chk'
  ) then
    alter table public.company_inventory_settings
      add constraint company_inventory_settings_mfg_expiry_policy_chk
      check (
        manufacturing_produce_expiry_policy in (
          'min_component',
          'production_plus_days',
          'min_of_both',
          'manual'
        )
      );
  end if;
end $$;

comment on column public.company_inventory_settings.manufacturing_produce_expiry_policy is
  'Suggest produce-line expiry on manufacturing: min_component | production_plus_days | min_of_both | manual';

-- 3) دوال الترحيل والتحقق
-- انسخ أحدث create or replace لـ:
--   public.create_material_with_base_unit
--   public.post_invoice_apply_manufacturing
--   public.post_invoice_apply_disassembly
-- من database/setup_all.sql (آخر تعريف لكل دالة في الملف)،
-- أو أعد تشغيل الملف الموحّد بالكامل في بيئة البناء.
