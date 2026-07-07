-- =============================================================================
-- patch_materials_item_card.sql (#31)
-- =============================================================================
-- توسيع بطاقة المادة: مواصفات إضافية + أسعار per وحدة.
-- =============================================================================

alter table public.materials
  add column if not exists barcode varchar(50) null,
  add column if not exists manufacturer varchar(200) null,
  add column if not exists supplier_name varchar(200) null,
  add column if not exists color varchar(100) null,
  add column if not exists size varchar(100) null,
  add column if not exists weight numeric(18, 4) null check (weight is null or weight >= 0),
  add column if not exists notes text null,
  add column if not exists max_stock numeric(18, 6) not null default 0 check (max_stock >= 0);

comment on column public.materials.barcode is 'باركود المادة';
comment on column public.materials.manufacturer is 'الشركة المصنعة';
comment on column public.materials.supplier_name is 'المورد (نص حر)';
comment on column public.materials.max_stock is 'حد أعلى للمخزون — وحدة أساس';

alter table public.material_units
  add column if not exists purchase_price numeric(18, 4) null check (purchase_price is null or purchase_price >= 0),
  add column if not exists sale_price numeric(18, 4) null check (sale_price is null or sale_price >= 0),
  add column if not exists semi_wholesale_price numeric(18, 4) null
    check (semi_wholesale_price is null or semi_wholesale_price >= 0),
  add column if not exists wholesale_price numeric(18, 4) null
    check (wholesale_price is null or wholesale_price >= 0);

comment on column public.material_units.purchase_price is 'سعر شراء الوحدة — null يعني اشتقاق من الأساس';
comment on column public.material_units.sale_price is 'سعر بيع الوحدة';
comment on column public.material_units.semi_wholesale_price is 'سعر نصف جملة';
comment on column public.material_units.wholesale_price is 'سعر جملة';
