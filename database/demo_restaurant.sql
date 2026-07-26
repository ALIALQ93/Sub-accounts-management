-- =============================================================================
-- demo_restaurant.sql — بذور عرض لمطعم (بعد setup_all أو ضمن الملف الموحّد)
-- =============================================================================
-- الاستخدام الموصى به (حذف كامل + إعادة بناء + بذور):
--     شغّل database/setup_demo_restaurant.sql كاملاً في SQL Editor
--
-- هذا الملف وحده: يعيد زرع/تحديث بيانات العرض على مخطط موجود.
-- إن وُجدت بذور سابقة يمسج بيانات العرض DEMO-* ثم يعيد الزرع.
--
-- إعادة توليد الملف الموحّد:
--     powershell -File database/build_setup_demo_restaurant.ps1
-- =============================================================================

do $$
begin
  if not exists (select 1 from public.accounts where code = '1') then
    raise exception
      'demo_restaurant: المخطط غير جاهز. شغّل setup_all.sql أو setup_demo_restaurant.sql أولاً.';
  end if;
end $$;

-- إن كانت بذور العرض موجودة: امسح مستندات/حركات العرض فقط ثم تابع الزرع
do $$
begin
  if not exists (
    select 1 from public.company_settings
    where id = 1 and legal_name_ar = 'مطعم الباب الذهبي'
  ) and not exists (
    select 1 from public.invoices where invoice_no like 'DEMO-%'
  ) then
    return;
  end if;

  raise notice 'demo_restaurant: جاري مسح بيانات العرض السابقة قبل إعادة الزرع…';

  -- تعطيل المحفزات مؤقتاً (postgres) لمسح فواتير مرحّلة
  perform set_config('session_replication_role', 'replica', true);

  update public.invoices i
  set journal_entry_id = null,
      status = 'draft',
      updated_at = now()
  where i.invoice_no like 'DEMO-%';

  delete from public.inventory_movements im
  where im.source_type = 'invoice'
    and im.source_id in (select id from public.invoices where invoice_no like 'DEMO-%');

  delete from public.inventory_movements
  where source_type = 'demo'
     or source_id in (
       'a0111111-1111-4111-8111-111111111111'::uuid,
       'a0222222-2222-4222-8222-222222222222'::uuid,
       'a0333333-3333-4333-8333-333333333333'::uuid
     );

  delete from public.journal_entry_lines jel
  where jel.journal_entry_id in (
    select je.id from public.journal_entries je
    where je.source_type = 'invoice'
      and je.source_id in (select id from public.invoices where invoice_no like 'DEMO-%')
  );

  delete from public.journal_entries
  where source_type = 'invoice'
    and source_id in (select id from public.invoices where invoice_no like 'DEMO-%');

  delete from public.journal_entry_lines jel
  where jel.journal_entry_id in (
    select je.id from public.journal_entries je
    where je.entry_no like 'OPEN-%-MAIN'
       or je.entry_no like 'DEMO-%'
       or je.source_type in ('demo', 'demo_opening')
  );

  delete from public.journal_entries
  where entry_no like 'OPEN-%-MAIN'
     or entry_no like 'DEMO-%'
     or source_type in ('demo', 'demo_opening');

  delete from public.inventory_transfer_lines
  where transfer_id in (
    select id from public.inventory_transfers where transfer_no like 'DEMO-%'
  );
  update public.inventory_transfers
  set out_invoice_id = null, in_invoice_id = null
  where transfer_no like 'DEMO-%';
  delete from public.inventory_transfers where transfer_no like 'DEMO-%';

  delete from public.invoice_material_lines
  where invoice_id in (select id from public.invoices where invoice_no like 'DEMO-%');
  delete from public.invoice_account_lines
  where invoice_id in (select id from public.invoices where invoice_no like 'DEMO-%');
  delete from public.invoices where invoice_no like 'DEMO-%';

  perform set_config('session_replication_role', 'origin', true);
end $$;

-- ---------------------------------------------------------------------------
-- 1) بيانات الشركة
-- ---------------------------------------------------------------------------

update public.company_settings
set
  legal_name_ar = 'مطعم الباب الذهبي',
  legal_name_en = 'Golden Gate Restaurant',
  tax_number = 'TAX-REST-DEMO-001',
  address = 'بغداد — الكرادة، شارع أبو نؤاس',
  phone = '+964 770 000 1122',
  email = 'demo@goldengate.example',
  fiscal_year_start_month = 1,
  base_currency_id = (select id from public.currencies where is_base = true limit 1),
  updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------
-- 2) دليل حسابات مناسب لمطعم
-- ---------------------------------------------------------------------------

with roots as (
  select code, id from public.accounts where code in ('1', '2', '3', '4', '5', '6', '7')
),
base as (
  select id from public.currencies where is_base = true limit 1
)
insert into public.accounts (code, name_ar, name_en, parent_id, currency_id, is_postable, is_active)
select x.code, x.name_ar, x.name_en, r.id, b.id, x.is_postable, true
from (
  values
    ('11',   'الأصول المتداولة', 'Current assets', '1', false),
    ('12',   'المخزون', 'Inventory group', '1', false),
    ('21',   'الذمم الدائنة', 'Payables group', '2', false),
    ('41',   'إيرادات التشغيل', 'Operating revenue', '4', false),
    ('51',   'تكلفة البضاعة', 'COGS group', '5', false),
    ('61',   'مصاريف التشغيل', 'Operating expenses', '6', false)
) as x(code, name_ar, name_en, parent_code, is_postable)
join roots r on r.code = x.parent_code
cross join base b
on conflict (code) do nothing;

with parents as (
  select code, id from public.accounts where code in ('11', '12', '21', '41', '51', '61', '3')
),
base as (
  select id from public.currencies where is_base = true limit 1
)
insert into public.accounts (code, name_ar, name_en, parent_id, currency_id, is_postable, is_active)
select x.code, x.name_ar, x.name_en, p.id, b.id, true, true
from (
  values
    ('1101', 'الصندوق — كاشير', 'Cash — cashier', '11'),
    ('1102', 'البنك — الرافدين', 'Bank — Rafidain', '11'),
    ('1103', 'ذمم العملاء (أب)', 'AR parent', '11'),
    ('1201', 'مخزون المواد الغذائية', 'Food inventory', '12'),
    ('1202', 'مخزون المشروبات', 'Beverage inventory', '12'),
    ('2101', 'ذمم الموردين (أب)', 'AP parent', '21'),
    ('3101', 'رأس المال', 'Capital', '3'),
    ('4101', 'مبيعات أطباق', 'Food sales', '41'),
    ('4102', 'مبيعات مشروبات', 'Beverage sales', '41'),
    ('4103', 'مبيعات توصيل', 'Delivery sales', '41'),
    ('5101', 'تكلفة مبيعات الطعام', 'Food COGS', '51'),
    ('5102', 'تكلفة مبيعات المشروبات', 'Beverage COGS', '51'),
    ('6101', 'رواتب وأجور', 'Salaries', '61'),
    ('6102', 'إيجار المحل', 'Rent', '61'),
    ('6103', 'كهرباء وماء', 'Utilities', '61'),
    ('6104', 'مستهلكات مطبخ', 'Kitchen consumables', '61')
) as x(code, name_ar, name_en, parent_code)
join parents p on p.code = x.parent_code
cross join base b
on conflict (code) do nothing;

-- حسابات ذمم تفصيلية تحت الأب
with ar_parent as (select id from public.accounts where code = '1103'),
     ap_parent as (select id from public.accounts where code = '2101'),
     base as (select id from public.currencies where is_base = true limit 1)
insert into public.accounts (code, name_ar, name_en, parent_id, currency_id, is_postable, is_active)
select x.code, x.name_ar, x.name_en, x.parent_id, b.id, true, true
from (
  select '110301'::varchar as code, 'ذمم — شركات وفعاليات'::varchar as name_ar,
         'AR — Corporate'::varchar as name_en, (select id from ar_parent) as parent_id
  union all
  select '110302', 'ذمم — عملاء توصيل', 'AR — Delivery', (select id from ar_parent)
  union all
  select '210101', 'مورد — اللحوم الطازجة', 'Vendor — Meat', (select id from ap_parent)
  union all
  select '210102', 'مورد — خضار وفواكه', 'Vendor — Produce', (select id from ap_parent)
  union all
  select '210103', 'مورد — مشروبات', 'Vendor — Beverages', (select id from ap_parent)
) x
cross join base b
where x.parent_id is not null
on conflict (code) do nothing;

update public.party_settings
set
  customer_parent_account_id = (select id from public.accounts where code = '1103'),
  vendor_parent_account_id = (select id from public.accounts where code = '2101'),
  updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------
-- 3) فروع ومستودعات ومراكز كلفة
-- ---------------------------------------------------------------------------

update public.branches
set
  name_ar = 'الفرع الرئيسي — الكرادة',
  name_en = 'Main — Karrada',
  updated_at = now()
where branch_code = 'MAIN';

insert into public.branches (branch_code, name_ar, name_en, is_head_office, is_active)
select 'MANSOUR', 'فرع المنصور', 'Mansour branch', false, true
where not exists (select 1 from public.branches where branch_code = 'MANSOUR');

update public.warehouses
set
  name_ar = 'مستودع المطبخ الرئيسي',
  name_en = 'Main kitchen store',
  updated_at = now()
where warehouse_code = 'WH-MAIN';

insert into public.warehouses (warehouse_code, name_ar, name_en, branch_id, is_active)
select
  'WH-COLD',
  'غرفة التبريد',
  'Cold room',
  b.id,
  true
from public.branches b
where b.branch_code = 'MAIN'
  and not exists (select 1 from public.warehouses where warehouse_code = 'WH-COLD');

insert into public.warehouses (warehouse_code, name_ar, name_en, branch_id, is_active)
select
  'WH-MAN',
  'مستودع المنصور',
  'Mansour store',
  b.id,
  true
from public.branches b
where b.branch_code = 'MANSOUR'
  and not exists (select 1 from public.warehouses where warehouse_code = 'WH-MAN');

update public.branches b
set default_warehouse_id = w.id
from public.warehouses w
where b.branch_code = 'MAIN' and w.warehouse_code = 'WH-MAIN';

update public.branches b
set default_warehouse_id = w.id
from public.warehouses w
where b.branch_code = 'MANSOUR' and w.warehouse_code = 'WH-MAN';

insert into public.cost_centers (code, name_ar, name_en, is_active)
select x.code, x.name_ar, x.name_en, true
from (
  values
    ('CC-KIT', 'المطبخ', 'Kitchen'),
    ('CC-HALL', 'الصالة', 'Dining hall'),
    ('CC-DEL', 'التوصيل', 'Delivery')
) as x(code, name_ar, name_en)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4) إعدادات المخزون + فترة محاسبية
-- ---------------------------------------------------------------------------

insert into public.company_inventory_settings (id)
values (1)
on conflict (id) do nothing;

update public.company_inventory_settings
set
  inventory_method = 'perpetual',
  costing_method = 'weighted_avg',
  cost_per_warehouse = true,
  cost_per_cost_center = false,
  updated_at = now()
where id = 1
  and coalesce(foundation_locked, false) = false;

insert into public.accounting_periods (
  period_code, name_ar, fiscal_year, start_date, end_date, status, branch_id, is_active
)
select
  to_char(current_date, 'YYYY') || '-FY',
  'السنة المالية ' || to_char(current_date, 'YYYY'),
  extract(year from current_date)::int,
  make_date(extract(year from current_date)::int, 1, 1),
  make_date(extract(year from current_date)::int, 12, 31),
  'open',
  null,
  true
where not exists (
  select 1 from public.accounting_periods
  where period_code = to_char(current_date, 'YYYY') || '-FY'
    and branch_id is null
);

-- ---------------------------------------------------------------------------
-- 5) أصناف ومواد المطعم
-- ---------------------------------------------------------------------------

insert into public.material_categories (category_code, name_ar, name_en, is_active)
select x.code, x.name_ar, x.name_en, true
from (
  values
    ('MEAT', 'لحوم ودواجن', 'Meat & poultry'),
    ('VEG', 'خضار وبقول', 'Vegetables'),
    ('BEV', 'مشروبات', 'Beverages'),
    ('DRY', 'تموين جاف', 'Dry goods'),
    ('PACK', 'تغليف وتوصيل', 'Packaging'),
    ('DAIRY', 'ألبان ومبرّدات', 'Dairy & chilled'),
    ('MENU', 'أطباق قائمة', 'Menu dishes'),
    ('PREP', 'تحضير وتفكيك', 'Prep & disassembly'),
    ('EQUIP', 'معدات مطبخ', 'Kitchen equipment')
) as x(code, name_ar, name_en)
on conflict (category_code) do nothing;

-- وحدات كتالوج (اختياري)
insert into public.units (unit_code, name_ar, name_en, is_active)
select x.code, x.name_ar, x.name_en, true
from (
  values
    ('KG', 'كيلوغرام', 'Kilogram'),
    ('PC', 'قطعة', 'Piece'),
    ('LTR', 'لتر', 'Liter'),
    ('CTN', 'كرتون', 'Carton'),
    ('BAG', 'كيس', 'Bag')
) as x(code, name_ar, name_en)
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'units')
on conflict (unit_code) do nothing;

do $$
declare
  v_inv_food uuid;
  v_inv_bev uuid;
  v_cat_meat uuid;
  v_cat_veg uuid;
  v_cat_bev uuid;
  v_cat_dry uuid;
  v_cat_pack uuid;
  v_mat uuid;
begin
  select id into v_inv_food from public.accounts where code = '1201';
  select id into v_inv_bev from public.accounts where code = '1202';
  select id into v_cat_meat from public.material_categories where category_code = 'MEAT';
  select id into v_cat_veg from public.material_categories where category_code = 'VEG';
  select id into v_cat_bev from public.material_categories where category_code = 'BEV';
  select id into v_cat_dry from public.material_categories where category_code = 'DRY';
  select id into v_cat_pack from public.material_categories where category_code = 'PACK';

  -- مادة + وحدة أساس (+ وحدة فرعية إن لزم)
  perform 1; -- placeholder for clarity

  -- لحم غنم
  if not exists (select 1 from public.materials where material_code = 'M-LAMB') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-LAMB', 'لحم غنم', 'Lamb meat', v_cat_meat,
      18000, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-CHICK') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-CHICK', 'دجاج كامل', 'Whole chicken', v_cat_meat,
      4500, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'PC', 'قطعة', true, 1, 'multiply', 1, 0),
      (v_mat, 'CTN', 'كرتون (10)', false, 10, 'multiply', 10, 1);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-RICE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-RICE', 'رز بسمتي', 'Basmati rice', v_cat_dry,
      2500, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0),
      (v_mat, 'BAG', 'كيس 25كغ', false, 25, 'multiply', 25, 1);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-TOMATO') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-TOMATO', 'طماطم', 'Tomato', v_cat_veg,
      1200, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-ONION') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-ONION', 'بصل', 'Onion', v_cat_veg,
      800, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-OIL') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-OIL', 'زيت نباتي', 'Cooking oil', v_cat_dry,
      3500, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'LTR', 'لتر', true, 1, 'multiply', 1, 0),
      (v_mat, 'CTN', 'كرتون (12 لتر)', false, 12, 'multiply', 12, 1);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-COLA') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-COLA', 'مشروب غازي 330مل', 'Soft drink 330ml', v_cat_bev,
      400, 1000, v_inv_bev, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'PC', 'علبة', true, 1, 'multiply', 1, 0),
      (v_mat, 'CTN', 'كرتون (24)', false, 24, 'multiply', 24, 1);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-WATER') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-WATER', 'ماء معدني 500مل', 'Mineral water 500ml', v_cat_bev,
      200, 500, v_inv_bev, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values
      (v_mat, 'PC', 'زجاجة', true, 1, 'multiply', 1, 0),
      (v_mat, 'CTN', 'كرتون (12)', false, 12, 'multiply', 12, 1);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-BOX') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'M-BOX', 'علبة توصيل', 'Delivery box', v_cat_pack,
      150, 0, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'قطعة', true, 1, 'multiply', 1, 0);
  end if;

  -- أطباق جاهزة للبيع — تجميعية finished (تُصنَّع ثم تُباع كوحدة مخزون)
  if not exists (select 1 from public.materials where material_code = 'P-MANSAF') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'P-MANSAF', 'منسف غنم (طبق)', 'Lamb mansaf plate', v_cat_meat,
      8000, 18000, v_inv_food, true,
      'composite', 'finished', 'منتج نهائي — يُنتَج عبر فاتورة تصنيع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'P-GRILL') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'P-GRILL', 'مشاوي مشكلة (طبق)', 'Mixed grill plate', v_cat_meat,
      7000, 16000, v_inv_food, true,
      'composite', 'finished', 'منتج نهائي — يُنتَج عبر فاتورة تصنيع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'P-CHICK-R') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'P-CHICK-R', 'دجاج رز (طبق)', 'Chicken rice plate', v_cat_meat,
      3500, 9000, v_inv_food, true,
      'composite', 'finished', 'منتج نهائي — يُنتَج عبر فاتورة تصنيع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5ب) توسعة احترافية: تتبّع + تجميعية + BOM + تصنيع/تفكيك
-- ---------------------------------------------------------------------------

-- ترقية الأطباق القديمة إن وُجدت بدون نوع تجميعي
update public.materials m
set
  material_kind = 'composite',
  composite_mode = 'finished',
  notes = coalesce(m.notes, 'منتج نهائي — يُنتَج عبر فاتورة تصنيع'),
  category_id = coalesce(
    (select id from public.material_categories where category_code = 'MENU'),
    m.category_id
  ),
  updated_at = now()
where m.material_code in ('P-MANSAF', 'P-GRILL', 'P-CHICK-R')
  and (
    m.material_kind is distinct from 'composite'
    or m.composite_mode is distinct from 'finished'
  );

do $$
declare
  v_inv_food uuid;
  v_inv_bev uuid;
  v_cat_meat uuid;
  v_cat_veg uuid;
  v_cat_dairy uuid;
  v_cat_menu uuid;
  v_cat_prep uuid;
  v_cat_equip uuid;
  v_cat_pack uuid;
  v_mat uuid;
begin
  select id into v_inv_food from public.accounts where code = '1201';
  select id into v_inv_bev from public.accounts where code = '1202';
  select id into v_cat_meat from public.material_categories where category_code = 'MEAT';
  select id into v_cat_veg from public.material_categories where category_code = 'VEG';
  select id into v_cat_dairy from public.material_categories where category_code = 'DAIRY';
  select id into v_cat_menu from public.material_categories where category_code = 'MENU';
  select id into v_cat_prep from public.material_categories where category_code = 'PREP';
  select id into v_cat_equip from public.material_categories where category_code = 'EQUIP';
  select id into v_cat_pack from public.material_categories where category_code = 'PACK';

  -- جبن شرائح — صلاحية إجبارية عند الإدخال
  if not exists (select 1 from public.materials where material_code = 'M-CHEESE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      has_expiry_date, require_expiry_on_inbound, require_expiry_on_outbound,
      min_stock, notes
    ) values (
      'M-CHEESE', 'جبن شرائح', 'Sliced cheese', v_cat_dairy,
      9000, 0, v_inv_food, true,
      true, true, false,
      5, 'تتبّع صلاحية — مطلوب تاريخ عند الشراء'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  -- لبن/زبادي للمنسف — صلاحية
  if not exists (select 1 from public.materials where material_code = 'M-YOGURT') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      has_expiry_date, require_expiry_on_inbound, require_expiry_on_outbound,
      expiry_days, min_stock, notes
    ) values (
      'M-YOGURT', 'لبن للمناسف', 'Yogurt for mansaf', v_cat_dairy,
      2000, 0, v_inv_food, true,
      true, true, false,
      7, 10, 'صلاحية قصيرة — يُطلب التاريخ عند الشراء؛ العرض لا يُجبره عند التصنيع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  -- خس — صلاحية خفيفة
  if not exists (select 1 from public.materials where material_code = 'M-LETTUCE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      has_expiry_date, require_expiry_on_inbound, expiry_days, notes
    ) values (
      'M-LETTUCE', 'خس طازج', 'Fresh lettuce', v_cat_veg,
      1500, 0, v_inv_food, true,
      true, true, 5, 'خضار سريعة التلف'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  -- خبز برجر
  if not exists (select 1 from public.materials where material_code = 'M-BUN') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      has_expiry_date, require_expiry_on_inbound, expiry_days
    ) values (
      'M-BUN', 'خبز برجر', 'Burger bun', v_cat_pack,
      250, 0, v_inv_food, true,
      true, true, 4
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'قطعة', true, 1, 'multiply', 1, 0);
  end if;

  -- قطع دجاج ناتج تفكيك (عادية)
  if not exists (select 1 from public.materials where material_code = 'M-CHICK-BRST') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active, notes
    ) values (
      'M-CHICK-BRST', 'صدر دجاج (مقطّع)', 'Chicken breast (cut)', v_cat_prep,
      6000, 0, v_inv_food, true, 'ناتج تفكيك دجاجة كاملة'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-CHICK-LEG') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active, notes
    ) values (
      'M-CHICK-LEG', 'فخذ دجاج (مقطّع)', 'Chicken leg (cut)', v_cat_prep,
      4500, 0, v_inv_food, true, 'ناتج تفكيك دجاجة كاملة'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'M-CHICK-WING') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active, notes
    ) values (
      'M-CHICK-WING', 'جناح دجاج (مقطّع)', 'Chicken wing (cut)', v_cat_prep,
      3500, 0, v_inv_food, true, 'ناتج تفكيك دجاجة كاملة'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  -- ميزان مطبخ — رقم تسلسلي
  if not exists (select 1 from public.materials where material_code = 'EQ-SCALE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      has_serial_number, require_serial_on_inbound, require_serial_on_outbound,
      notes
    ) values (
      'EQ-SCALE', 'ميزان مطبخ رقمي', 'Digital kitchen scale', v_cat_equip,
      85000, 0, v_inv_food, true,
      true, true, true,
      'تتبّع برقم تسلسلي لكل جهاز'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'جهاز', true, 1, 'multiply', 1, 0);
  end if;

  -- برجر كلاسيك — finished
  if not exists (select 1 from public.materials where material_code = 'P-BURGER') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, min_stock, notes
    ) values (
      'P-BURGER', 'برجر لحم كلاسيك', 'Classic beef burger', v_cat_menu,
      2500, 7500, v_inv_food, true,
      'composite', 'finished', 15,
      'منتج نهائي نموذجي للمطعم — BOM + تصنيع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'برجر', true, 1, 'multiply', 1, 0);
  end if;

  -- وجبة كومبو — kit يتفكك عند البيع
  if not exists (select 1 from public.materials where material_code = 'K-COMBO') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'K-COMBO', 'وجبة برجر + مشروب', 'Burger meal combo', v_cat_menu,
      0, 9000, v_inv_food, true,
      'composite', 'kit',
      'طقم بيع: عند الإخراج يُستهلك البرجر+المشروب+العلبة (BOM متداخل)'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'وجبة', true, 1, 'multiply', 1, 0);
  end if;

  -- دجاجة للتفكيك — disassemblable
  if not exists (select 1 from public.materials where material_code = 'D-CHICK-WHOLE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'D-CHICK-WHOLE', 'دجاجة للتفكيك', 'Whole chicken for cutting', v_cat_prep,
      4500, 0, v_inv_food, true,
      'composite', 'disassemblable',
      'يُستهلك عبر فاتورة تفكيك وينتج صدراً/فخذاً/جناحاً (+ تالف اختياري)'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'دجاجة', true, 1, 'multiply', 1, 0);
  end if;

  -- توابل خلطة — مادة أولية للتتبيل
  if not exists (select 1 from public.materials where material_code = 'M-SPICE') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active, notes
    ) values (
      'M-SPICE', 'خلطة توابل مطبخ', 'Kitchen spice mix', v_cat_prep,
      12000, 0, v_inv_food, true,
      'تُستهلك في مرحلة التحضير (تتبيل اللحم/الدجاج)'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  -- —— مرحلة تحضير (finished تُخزَّن كـ «مادة أولية» للمبيعات/التصنيع التالي) ——
  if not exists (select 1 from public.materials where material_code = 'R-PATTY') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'R-PATTY', 'قرص برجر متبّل', 'Seasoned burger patty', v_cat_prep,
      2200, 0, v_inv_food, true,
      'composite', 'finished',
      'مرحلة 1: لحم ني + توابل → قرص جاهز للشوي/التجميع'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'قرص', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'R-LAMB-SEAS') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'R-LAMB-SEAS', 'لحم غنم متبّل', 'Seasoned lamb (prep)', v_cat_prep,
      19500, 0, v_inv_food, true,
      'composite', 'finished',
      'مرحلة 1: لحم ني متبّل — يُستخدم لاحقاً كمدخل للمنسف/المشاوي'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'KG', 'كيلو', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'R-CHICK-MAR') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active,
      material_kind, composite_mode, notes
    ) values (
      'R-CHICK-MAR', 'دجاج متبّل للشيّ', 'Marinated chicken (prep)', v_cat_prep,
      4800, 0, v_inv_food, true,
      'composite', 'finished',
      'مرحلة 1: دجاج ني متبّل — مدخل لأطباق الدجاج/المشاوي'
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'دجاجة', true, 1, 'multiply', 1, 0);
  end if;
end $$;

-- وصفات BOM — سلسلة مطعم متعددة المراحل
-- مرحلة 1 (تحضير): مواد نيّة → R-* مخزّنة كأولية للمرحلة التالية
-- مرحلة 2 (طبق): R-* + إضافات → P-* للبيع
do $$
declare
  r record;
begin
  for r in
    select * from (
      values
        -- مرحلة 1: قرص برجر متبّل
        ('R-PATTY', 'M-LAMB',   0.120000, 1, 'لحم ني'),
        ('R-PATTY', 'M-SPICE',  0.005000, 2, 'توابل'),
        ('R-PATTY', 'M-ONION',  0.010000, 3, null),
        ('R-PATTY', 'M-OIL',    0.005000, 4, null),
        -- مرحلة 1: لحم غنم متبّل (لكل 1 كغ)
        ('R-LAMB-SEAS', 'M-LAMB',  1.000000, 1, 'لحم ني'),
        ('R-LAMB-SEAS', 'M-SPICE', 0.020000, 2, null),
        ('R-LAMB-SEAS', 'M-OIL',   0.020000, 3, null),
        ('R-LAMB-SEAS', 'M-ONION', 0.050000, 4, null),
        -- مرحلة 1: دجاج متبّل
        ('R-CHICK-MAR', 'M-CHICK', 1.000000, 1, 'دجاج ني'),
        ('R-CHICK-MAR', 'M-SPICE', 0.010000, 2, null),
        ('R-CHICK-MAR', 'M-OIL',   0.030000, 3, null),
        ('R-CHICK-MAR', 'M-TOMATO',0.020000, 4, 'حمض خفيف'),
        -- مرحلة 2: برجر من القرص المتبّل (ليس من اللحم الني مباشرة)
        ('P-BURGER', 'R-PATTY',  1.000000, 1, 'قرص متبّل جاهز'),
        ('P-BURGER', 'M-BUN',    1.000000, 2, null),
        ('P-BURGER', 'M-CHEESE', 0.020000, 3, null),
        ('P-BURGER', 'M-LETTUCE',0.015000, 4, null),
        ('P-BURGER', 'M-TOMATO', 0.030000, 5, null),
        -- مرحلة 2: منسف من لحم متبّل
        ('P-MANSAF', 'R-LAMB-SEAS', 0.350000, 1, 'لحم متبّل محضّر'),
        ('P-MANSAF', 'M-RICE',   0.250000, 2, null),
        ('P-MANSAF', 'M-YOGURT', 0.150000, 3, null),
        ('P-MANSAF', 'M-OIL',    0.010000, 4, null),
        -- مرحلة 2: دجاج رز من دجاج متبّل
        ('P-CHICK-R','R-CHICK-MAR', 1.000000, 1, 'دجاج متبّل'),
        ('P-CHICK-R','M-RICE',   0.200000, 2, null),
        ('P-CHICK-R','M-ONION',  0.030000, 3, null),
        ('P-CHICK-R','M-OIL',    0.010000, 4, null),
        -- مرحلة 2: مشاوي من محضّرات
        ('P-GRILL',  'R-LAMB-SEAS', 0.200000, 1, null),
        ('P-GRILL',  'R-CHICK-MAR', 0.500000, 2, null),
        ('P-GRILL',  'M-ONION',  0.040000, 3, null),
        ('P-GRILL',  'M-TOMATO', 0.050000, 4, null),
        -- كومبو kit
        ('K-COMBO',  'P-BURGER', 1.000000, 1, 'برجر جاهز'),
        ('K-COMBO',  'M-COLA',   1.000000, 2, null),
        ('K-COMBO',  'M-BOX',    1.000000, 3, null),
        -- تفكيك
        ('D-CHICK-WHOLE', 'M-CHICK-BRST', 0.350000, 1, 'عائد متوقع — صدر'),
        ('D-CHICK-WHOLE', 'M-CHICK-LEG',  0.400000, 2, 'عائد متوقع — فخذ'),
        ('D-CHICK-WHOLE', 'M-CHICK-WING', 0.150000, 3, 'عائد متوقع — جناح')
    ) as x(parent_code, component_code, qty_base, sort_order, notes)
  loop
    insert into public.material_bom_components (
      parent_material_id, component_material_id,
      quantity, quantity_base, component_unit_id, sort_order, notes
    )
    select
      p.id,
      c.id,
      r.qty_base,
      r.qty_base,
      mu.id,
      r.sort_order,
      r.notes
    from public.materials p
    join public.materials c on c.material_code = r.component_code
    left join public.material_units mu
      on mu.material_id = c.id and mu.is_base_unit = true
    where p.material_code = r.parent_code
      and not exists (
        select 1
        from public.material_bom_components b
        where b.parent_material_id = p.id
          and b.component_material_id = c.id
      );
  end loop;

  -- إزالة وصفات قديمة كانت تربط الأطباق باللحم الني مباشرة (إن وُجدت من بذور سابقة)
  delete from public.material_bom_components b
  using public.materials p, public.materials c
  where b.parent_material_id = p.id
    and b.component_material_id = c.id
    and (
      (p.material_code = 'P-BURGER' and c.material_code = 'M-LAMB')
      or (p.material_code = 'P-MANSAF' and c.material_code in ('M-LAMB', 'M-ONION'))
      or (p.material_code = 'P-CHICK-R' and c.material_code = 'M-CHICK')
      or (p.material_code = 'P-GRILL' and c.material_code in ('M-LAMB', 'M-CHICK', 'M-OIL'))
    );
end $$;

-- ---------------------------------------------------------------------------
-- 6) عملاء وموردون
-- ---------------------------------------------------------------------------

insert into public.customers (customer_code, name_ar, phone, receivable_account_id, is_active)
select 'C-WALK', 'عميل نقدي — صالة', '0770-111-0001', a.id, true
from public.accounts a where a.code = '110301'
on conflict (customer_code) do nothing;

insert into public.customers (customer_code, name_ar, phone, receivable_account_id, is_active)
select 'C-CORP', 'شركة الأفق للمؤتمرات', '0770-111-0002', a.id, true
from public.accounts a where a.code = '110301'
on conflict (customer_code) do nothing;

insert into public.customers (customer_code, name_ar, phone, receivable_account_id, is_active)
select 'C-DEL', 'عملاء تطبيقات التوصيل', '0770-111-0003', a.id, true
from public.accounts a where a.code = '110302'
on conflict (customer_code) do nothing;

insert into public.vendors (vendor_code, name_ar, phone, payable_account_id, is_active)
select 'V-MEAT', 'مؤسسة اللحوم الطازجة', '0770-222-0001', a.id, true
from public.accounts a where a.code = '210101'
on conflict (vendor_code) do nothing;

insert into public.vendors (vendor_code, name_ar, phone, payable_account_id, is_active)
select 'V-VEG', 'سوق الخضار المركزي', '0770-222-0002', a.id, true
from public.accounts a where a.code = '210102'
on conflict (vendor_code) do nothing;

insert into public.vendors (vendor_code, name_ar, phone, payable_account_id, is_active)
select 'V-BEV', 'وكالات المشروبات', '0770-222-0003', a.id, true
from public.accounts a where a.code = '210103'
on conflict (vendor_code) do nothing;

-- ---------------------------------------------------------------------------
-- 7) ربط أنماط الفواتير بحسابات المطعم
-- ---------------------------------------------------------------------------

update public.invoice_patterns
set
  default_debtor_account_id = (select id from public.accounts where code = '1101'),
  default_creditor_account_id = (select id from public.accounts where code = '4101'),
  default_cost_account_id = (select id from public.accounts where code = '5101'),
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  discount_enabled = true,
  discount_applies_to = 'line',
  max_discount_percent = 15,
  line_extra_enabled = false,
  enforce_stock_availability = true,
  warehouse_movement = true
where commercial_kind = 'sale' and name_ar = 'مبيعات';

update public.invoice_patterns
set
  default_creditor_account_id = (select id from public.accounts where code = '210101'),
  default_debtor_account_id = (select id from public.accounts where code = '1201'),
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  warehouse_movement = true
where commercial_kind = 'purchase' and name_ar = 'مشتريات';

update public.invoice_patterns
set
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  transfer_transit_account_id = (select id from public.accounts where code = '1201'),
  warehouse_movement = true
where commercial_kind in ('transfer_out', 'transfer_in');

update public.invoice_patterns
set
  default_debtor_account_id = (select id from public.accounts where code = '4101'),
  default_creditor_account_id = (select id from public.accounts where code = '1101'),
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  default_cost_account_id = (select id from public.accounts where code = '5101'),
  warehouse_movement = true
where commercial_kind = 'return_sale';

update public.invoice_patterns
set
  default_creditor_account_id = (select id from public.accounts where code = '1201'),
  default_debtor_account_id = (select id from public.accounts where code = '210101'),
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  warehouse_movement = true
where commercial_kind = 'return_purchase';

update public.invoice_patterns
set
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  default_creditor_account_id = (select id from public.accounts where code = '3101'),
  warehouse_movement = true
where commercial_kind = 'opening_stock';

-- تصنيع: استهلاك مكوّنات → إنتاج أطباق finished
update public.invoice_patterns
set
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  default_cost_account_id = (select id from public.accounts where code = '5101'),
  default_creditor_account_id = (select id from public.accounts where code = '1201'),
  warehouse_movement = true,
  generate_journal = true,
  enforce_stock_availability = true,
  pricing_consumed_mode = coalesce(pricing_consumed_mode, 'weighted_avg'),
  pricing_cost_mode = coalesce(pricing_cost_mode, 'line_net')
where commercial_kind = 'manufacturing';

-- تفكيك: دجاجة كاملة → قطع (+ تالف اختياري)
update public.invoice_patterns
set
  default_inventory_account_id = (select id from public.accounts where code = '1201'),
  default_cost_account_id = (select id from public.accounts where code = '5101'),
  warehouse_movement = true,
  generate_journal = true,
  enforce_stock_availability = true
where commercial_kind = 'disassembly';

insert into public.invoice_pattern_conditions (pattern_id, require_warehouse)
select p.id, true
from public.invoice_patterns p
where p.commercial_kind in ('manufacturing', 'disassembly')
  and not exists (
    select 1 from public.invoice_pattern_conditions c where c.pattern_id = p.id
  );

-- ---------------------------------------------------------------------------
-- 8) نقطة بيع
-- ---------------------------------------------------------------------------

insert into public.pos_points (
  point_code, name_ar, name_en, branch_id, warehouse_id, invoice_pattern_id,
  default_customer_id, default_debtor_account_id, default_creditor_account_id,
  receipt_header, receipt_footer, allow_line_discount, require_customer,
  is_active, sort_order
)
select
  'POS-HALL',
  'كاشير الصالة',
  'Hall cashier',
  b.id,
  w.id,
  p.id,
  c.id,
  cash.id,
  sales.id,
  'مطعم الباب الذهبي — أهلاً بكم',
  'شكراً لزيارتكم — تقييمكم يهمنا',
  true,
  false,
  true,
  10
from public.branches b
join public.warehouses w on w.warehouse_code = 'WH-MAIN'
join public.invoice_patterns p on p.commercial_kind = 'sale' and p.name_ar = 'مبيعات'
join public.customers c on c.customer_code = 'C-WALK'
join public.accounts cash on cash.code = '1101'
join public.accounts sales on sales.code = '4101'
where b.branch_code = 'MAIN'
  and not exists (select 1 from public.pos_points where point_code = 'POS-HALL');

-- طرق الدفع: واحدة افتراضية فقط لكل نقطة (قيد idx_pos_payment_one_default)
do $$
declare
  v_pos uuid;
  v_cash uuid;
  v_card uuid;
  v_has_default boolean;
begin
  select id into v_pos from public.pos_points where point_code = 'POS-HALL';
  if v_pos is null then
    return;
  end if;

  select id into v_cash from public.accounts where code = '1101';
  select id into v_card from public.accounts where code = '1102';

  select exists (
    select 1 from public.pos_point_payment_methods
    where pos_point_id = v_pos and is_default = true
  ) into v_has_default;

  if not exists (
    select 1 from public.pos_point_payment_methods
    where pos_point_id = v_pos and account_id = v_cash
  ) then
    insert into public.pos_point_payment_methods (
      pos_point_id, account_id, label_ar, label_en, is_default, sort_order, is_active
    ) values (
      v_pos, v_cash, 'نقداً', 'Cash', not v_has_default, 1, true
    );
    v_has_default := true;
  end if;

  if not exists (
    select 1 from public.pos_point_payment_methods
    where pos_point_id = v_pos and account_id = v_card
  ) then
    insert into public.pos_point_payment_methods (
      pos_point_id, account_id, label_ar, label_en, is_default, sort_order, is_active
    ) values (
      v_pos, v_card, 'بطاقة', 'Card', false, 2, true
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9) رصيد افتتاحي مخزون (حركات مباشرة)
-- ---------------------------------------------------------------------------

do $$
declare
  v_src uuid := 'a0111111-1111-4111-8111-111111111111'::uuid;
  v_wh uuid;
  v_br uuid;
  v_cc uuid;
  r record;
begin
  select id into v_wh from public.warehouses where warehouse_code = 'WH-MAIN';
  select id into v_br from public.branches where branch_code = 'MAIN';
  select id into v_cc from public.cost_centers where code = 'CC-KIT';

  if exists (
    select 1 from public.inventory_movements
    where source_type = 'demo' and source_id = v_src
  ) then
    return;
  end if;

  for r in
    select m.id as material_id, m.purchase_price, m.material_code,
           case m.material_code
             when 'M-LAMB' then 40
             when 'M-CHICK' then 80
             when 'M-RICE' then 100
             when 'M-TOMATO' then 30
             when 'M-ONION' then 25
             when 'M-OIL' then 24
             when 'M-COLA' then 120
             when 'M-WATER' then 96
             when 'M-BOX' then 200
             when 'M-YOGURT' then 20
             when 'M-LETTUCE' then 8
             when 'M-BUN' then 80
             when 'M-SPICE' then 5
             when 'M-CHEESE' then 8
             when 'M-CHICK-BRST' then 2
             when 'M-CHICK-LEG' then 2
             when 'M-CHICK-WING' then 1
             when 'D-CHICK-WHOLE' then 20
             -- الأطباق والمحضّرات تُنشأ عبر فواتير التصنيع التجريبية أدناه
             else null
           end as qty
    from public.materials m
    where m.material_code in (
      'M-LAMB', 'M-CHICK', 'M-RICE', 'M-TOMATO', 'M-ONION', 'M-OIL',
      'M-COLA', 'M-WATER', 'M-BOX',
      'M-YOGURT', 'M-LETTUCE', 'M-BUN', 'M-SPICE', 'M-CHEESE',
      'M-CHICK-BRST', 'M-CHICK-LEG', 'M-CHICK-WING',
      'D-CHICK-WHOLE'
    )
  loop
    if r.qty is null then
      continue;
    end if;
    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id
    ) values (
      current_date - 7,
      r.material_id, v_wh, v_br, v_cc,
      r.qty, r.qty,
      r.purchase_price,
      round((r.qty * r.purchase_price)::numeric, 2),
      'opening_stock', 'demo', v_src
    );
  end loop;

  -- دفعات صلاحية للجبن في المطبخ (تاريخ أقدم من فواتير التصنيع)
  insert into public.inventory_movements (
    movement_date, material_id, warehouse_id, branch_id, cost_center_id,
    quantity_delta, quantity_base_delta, unit_cost, total_cost,
    movement_kind, source_type, source_id, expiry_date
  )
  select
    current_date - 12,
    m.id, v_wh, v_br, v_cc,
    x.qty, x.qty,
    m.purchase_price,
    round((x.qty * m.purchase_price)::numeric, 2),
    'opening_stock', 'demo', 'a0222222-2222-4222-8222-222222222222'::uuid,
    x.expiry
  from public.materials m
  cross join (
    values
      (4::numeric, (current_date + 12)),
      (3::numeric, (current_date + 25))
  ) as x(qty, expiry)
  where m.material_code = 'M-CHEESE'
    and not exists (
      select 1 from public.inventory_movements im
      where im.source_type = 'demo'
        and im.source_id = 'a0222222-2222-4222-8222-222222222222'::uuid
    );

  -- موازين مطبخ بأرقام تسلسلية
  insert into public.inventory_movements (
    movement_date, material_id, warehouse_id, branch_id, cost_center_id,
    quantity_delta, quantity_base_delta, unit_cost, total_cost,
    movement_kind, source_type, source_id, serial_number
  )
  select
    current_date - 3,
    m.id, v_wh, v_br, v_cc,
    1, 1,
    m.purchase_price,
    m.purchase_price,
    'opening_stock', 'demo', 'a0333333-3333-4333-8333-333333333333'::uuid,
    x.serial_no
  from public.materials m
  cross join (
    values
      ('SCALE-GG-001'),
      ('SCALE-GG-002')
  ) as x(serial_no)
  where m.material_code = 'EQ-SCALE'
    and not exists (
      select 1 from public.inventory_movements im
      where im.source_type = 'demo'
        and im.source_id = 'a0333333-3333-4333-8333-333333333333'::uuid
    );

  perform public.lock_company_inventory_foundation((current_date - 7)::timestamptz);
end $$;

-- ---------------------------------------------------------------------------
-- 10) قيد افتتاحي واضح + مستندات تشغيل تجريبية (مرحّلة)
-- ---------------------------------------------------------------------------
-- يتطلب تشغيل SQL كـ postgres/supabase_admin (تجاوز صلاحية الترحيل في البذور).
-- التسلسل الزمني:
--   1/1   قيد افتتاحي
--   -10ش  مشتريات إلى غرفة التبريد
--   -9    مناقلة تبريد → مطبخ (نفس الفرع)
--   -7    تصنيع مرحلة 1 (تتبيل)
--   -6    تصنيع مرحلة 2 (أطباق)
--   -4    مناقلة فرع رئيسي → المنصور
--   -2    مبيعات صالة
-- ---------------------------------------------------------------------------

-- 10-أ) قيد افتتاحي محاسبي
do $$
declare
  v_je uuid;
  v_cur uuid;
  v_br uuid;
  v_cash uuid;
  v_bank uuid;
  v_inv uuid;
  v_ar uuid;
  v_cap uuid;
  v_year int := extract(year from current_date)::int;
begin
  if exists (
    select 1 from public.journal_entries
    where entry_no = 'OPEN-' || v_year::text || '-MAIN'
       or (is_opening_entry = true and source_type = 'demo_opening')
  ) then
    return;
  end if;

  select id into v_cur from public.currencies where is_base = true;
  select id into v_br from public.branches where branch_code = 'MAIN';
  select id into v_cash from public.accounts where code = '1101';
  select id into v_bank from public.accounts where code = '1102';
  select id into v_inv from public.accounts where code = '1201';
  select id into v_ar from public.accounts where code = '110301';
  select id into v_cap from public.accounts where code = '3101';

  insert into public.journal_entries (
    entry_no, entry_date, description, status, source_type, branch_id, is_opening_entry
  ) values (
    'OPEN-' || v_year::text || '-MAIN',
    make_date(v_year, 1, 1),
    'قيد افتتاحي — أرصدة بداية السنة (صندوق + بنك + مخزون + ذمم / رأس مال)',
    'posted', 'demo_opening', v_br, true
  ) returning id into v_je;

  insert into public.journal_entry_lines (
    journal_entry_id, account_id, debit, credit, debit_base, credit_base,
    currency_id, exchange_rate, line_description, branch_id
  ) values
    (v_je, v_cash, 2500000, 0, 2500000, 0, v_cur, 1, 'رصيد افتتاحي — صندوق', v_br),
    (v_je, v_bank, 8000000, 0, 8000000, 0, v_cur, 1, 'رصيد افتتاحي — بنك', v_br),
    (v_je, v_inv,  3500000, 0, 3500000, 0, v_cur, 1, 'رصيد افتتاحي — مخزون غذائي', v_br),
    (v_je, v_ar,   600000, 0, 600000, 0, v_cur, 1, 'رصيد افتتاحي — ذمم شركات', v_br),
    (v_je, v_cap,  0, 14600000, 0, 14600000, v_cur, 1, 'رأس المال الافتتاحي', v_br);
end $$;

-- 10-ب) مساعد أسطر فاتورة + ترحيل المستندات
create or replace function public.demo_seed_add_line(
  p_invoice_id uuid,
  p_line_no int,
  p_branch_id uuid,
  p_cc_id uuid,
  p_warehouse_id uuid,
  p_material_code text,
  p_qty numeric,
  p_unit_price numeric,
  p_mfg_role text default null,
  p_qty_received numeric default null,
  p_expiry date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mat uuid;
  v_unit uuid;
begin
  select id into v_mat from public.materials where material_code = p_material_code;
  if v_mat is null then
    raise exception 'demo seed: material % missing', p_material_code;
  end if;
  select id into v_unit
  from public.material_units
  where material_id = v_mat and is_base_unit = true
  limit 1;

  insert into public.invoice_material_lines (
    invoice_id, line_no, branch_id, cost_center_id, warehouse_id,
    material_id, material_unit_id, quantity, quantity_base, unit_price, line_amount,
    manufacturing_role, qty_received, expiry_date
  ) values (
    p_invoice_id, p_line_no, p_branch_id, p_cc_id, p_warehouse_id,
    v_mat, v_unit, p_qty, p_qty, p_unit_price,
    round((p_qty * p_unit_price)::numeric, 2),
    p_mfg_role, p_qty_received, p_expiry
  );
end;
$$;

do $$
declare
  v_br_main uuid;
  v_br_man uuid;
  v_wh_main uuid;
  v_wh_cold uuid;
  v_wh_man uuid;
  v_cc uuid;
  v_cur uuid;
  v_inv_acct uuid;
  v_cogs uuid;
  v_sales uuid;
  v_cash uuid;
  v_ap_meat uuid;
  v_vendor uuid;
  v_customer uuid;
  v_pat_pur uuid;
  v_pat_sal uuid;
  v_pat_tro uuid;
  v_pat_tri uuid;
  v_pat_mfg uuid;
  v_xfer uuid;
  v_inv uuid;
  v_no text;
begin
  if exists (select 1 from public.invoices where invoice_no like 'DEMO-%') then
    return;
  end if;

  select id into v_br_main from public.branches where branch_code = 'MAIN';
  select id into v_br_man from public.branches where branch_code = 'MANSOUR';
  select id into v_wh_main from public.warehouses where warehouse_code = 'WH-MAIN';
  select id into v_wh_cold from public.warehouses where warehouse_code = 'WH-COLD';
  select id into v_wh_man from public.warehouses where warehouse_code = 'WH-MAN';
  select id into v_cc from public.cost_centers where code = 'CC-KIT';
  select id into v_cur from public.currencies where is_base = true;
  select id into v_inv_acct from public.accounts where code = '1201';
  select id into v_cogs from public.accounts where code = '5101';
  select id into v_sales from public.accounts where code = '4101';
  select id into v_cash from public.accounts where code = '1101';
  select id into v_ap_meat from public.accounts where code = '210101';
  select id into v_vendor from public.vendors where vendor_code = 'V-MEAT';
  select id into v_customer from public.customers where customer_code = 'C-WALK';
  select id into v_pat_pur from public.invoice_patterns where commercial_kind = 'purchase' and name_ar = 'مشتريات';
  select id into v_pat_sal from public.invoice_patterns where commercial_kind = 'sale' and name_ar = 'مبيعات';
  select id into v_pat_tro from public.invoice_patterns where commercial_kind = 'transfer_out' limit 1;
  select id into v_pat_tri from public.invoice_patterns where commercial_kind = 'transfer_in' limit 1;
  select id into v_pat_mfg from public.invoice_patterns where commercial_kind = 'manufacturing' limit 1;

  -- —— مشتريات إلى غرفة التبريد ——
  v_no := 'DEMO-PUR-001';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    vendor_id, creditor_account_id, debtor_account_id, inventory_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_pur, v_no, current_date - 10, v_br_main, v_cc,
    v_vendor, v_ap_meat, v_inv_acct, v_inv_acct,
    'credit', v_cur, 1,
    'عرض — شراء لحوم ودواجن وتوابل (غرفة تبريد)',
    'draft'
  ) returning id into v_inv;

  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_cold, 'M-LAMB', 25, 18000);
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_cold, 'M-CHICK', 40, 4500);
  perform public.demo_seed_add_line(v_inv, 3, v_br_main, v_cc, v_wh_cold, 'M-SPICE', 2, 12000);
  perform public.demo_seed_add_line(
    v_inv, 4, v_br_main, v_cc, v_wh_cold, 'M-CHEESE', 5, 9000,
    null, null, current_date + 20
  );
  perform public.post_invoice(v_inv);

  -- —— مناقلة نفس الفرع: تبريد → مطبخ ——
  v_no := 'DEMO-TRO-COLD';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, transfer_transit_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_tro, v_no, current_date - 9, v_br_main, v_cc,
    v_inv_acct, v_inv_acct,
    'credit', v_cur, 1,
    'عرض — مناقلة من التبريد إلى المطبخ',
    'draft'
  ) returning id into v_inv;
  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_cold, 'M-LAMB', 15, 18000);
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_cold, 'M-CHICK', 20, 4500);
  perform public.demo_seed_add_line(v_inv, 3, v_br_main, v_cc, v_wh_cold, 'M-SPICE', 1, 12000);
  perform public.demo_seed_add_line(
    v_inv, 4, v_br_main, v_cc, v_wh_cold, 'M-CHEESE', 3, 9000,
    null, null, current_date + 20
  );
  perform public.post_invoice(v_inv);

  v_no := 'DEMO-TRI-KIT';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, transfer_transit_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_tri, v_no, current_date - 9, v_br_main, v_cc,
    v_inv_acct, v_inv_acct,
    'credit', v_cur, 1,
    'عرض — استلام مناقلة في المطبخ',
    'draft'
  ) returning id into v_inv;
  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_main, 'M-LAMB', 15, 18000, null, 15);
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_main, 'M-CHICK', 20, 4500, null, 20);
  perform public.demo_seed_add_line(v_inv, 3, v_br_main, v_cc, v_wh_main, 'M-SPICE', 1, 12000, null, 1);
  perform public.demo_seed_add_line(
    v_inv, 4, v_br_main, v_cc, v_wh_main, 'M-CHEESE', 3, 9000,
    null, 3, current_date + 20
  );
  perform public.post_invoice(v_inv);

  -- —— تصنيع مرحلة 1: تتبيل ——
  v_no := 'DEMO-MFG-PREP';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, cost_account_id, creditor_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_mfg, v_no, current_date - 7, v_br_main, v_cc,
    v_inv_acct, v_cogs, v_inv_acct,
    'credit', v_cur, 1,
    'عرض — تصنيع مرحلة 1: تتبيل لحم/دجاج (محضّرات R-*)',
    'draft'
  ) returning id into v_inv;

  -- استهلاك نيّ
  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_main, 'M-LAMB', 8, 18000, 'consume');
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_main, 'M-CHICK', 15, 4500, 'consume');
  perform public.demo_seed_add_line(v_inv, 3, v_br_main, v_cc, v_wh_main, 'M-SPICE', 0.2, 12000, 'consume');
  perform public.demo_seed_add_line(v_inv, 4, v_br_main, v_cc, v_wh_main, 'M-ONION', 0.8, 800, 'consume');
  perform public.demo_seed_add_line(v_inv, 5, v_br_main, v_cc, v_wh_main, 'M-OIL', 0.6, 3500, 'consume');
  perform public.demo_seed_add_line(v_inv, 6, v_br_main, v_cc, v_wh_main, 'M-TOMATO', 0.3, 1200, 'consume');
  -- إنتاج محضّرات
  perform public.demo_seed_add_line(v_inv, 7, v_br_main, v_cc, v_wh_main, 'R-PATTY', 40, 2200, 'produce');
  perform public.demo_seed_add_line(v_inv, 8, v_br_main, v_cc, v_wh_main, 'R-LAMB-SEAS', 3, 19500, 'produce');
  perform public.demo_seed_add_line(v_inv, 9, v_br_main, v_cc, v_wh_main, 'R-CHICK-MAR', 15, 4800, 'produce');
  perform public.post_invoice(v_inv);

  -- —— تصنيع مرحلة 2: أطباق نهائية ——
  v_no := 'DEMO-MFG-MENU';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, cost_account_id, creditor_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_mfg, v_no, current_date - 6, v_br_main, v_cc,
    v_inv_acct, v_cogs, v_inv_acct,
    'credit', v_cur, 1,
    'عرض — تصنيع مرحلة 2: برجر/منسف/دجاج رز من المحضّرات',
    'draft'
  ) returning id into v_inv;

  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_main, 'R-PATTY', 25, 2200, 'consume');
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_main, 'R-LAMB-SEAS', 2, 19500, 'consume');
  perform public.demo_seed_add_line(v_inv, 3, v_br_main, v_cc, v_wh_main, 'R-CHICK-MAR', 10, 4800, 'consume');
  perform public.demo_seed_add_line(v_inv, 4, v_br_main, v_cc, v_wh_main, 'M-BUN', 25, 250, 'consume');
  perform public.demo_seed_add_line(v_inv, 5, v_br_main, v_cc, v_wh_main, 'M-CHEESE', 0.5, 9000, 'consume', null, current_date + 20);
  perform public.demo_seed_add_line(v_inv, 6, v_br_main, v_cc, v_wh_main, 'M-LETTUCE', 0.4, 1500, 'consume');
  perform public.demo_seed_add_line(v_inv, 7, v_br_main, v_cc, v_wh_main, 'M-TOMATO', 0.8, 1200, 'consume');
  perform public.demo_seed_add_line(v_inv, 8, v_br_main, v_cc, v_wh_main, 'M-RICE', 4, 2500, 'consume');
  perform public.demo_seed_add_line(v_inv, 9, v_br_main, v_cc, v_wh_main, 'M-YOGURT', 1.5, 2000, 'consume', null, current_date + 5);
  perform public.demo_seed_add_line(v_inv, 10, v_br_main, v_cc, v_wh_main, 'M-ONION', 0.4, 800, 'consume');
  perform public.demo_seed_add_line(v_inv, 11, v_br_main, v_cc, v_wh_main, 'M-OIL', 0.3, 3500, 'consume');

  perform public.demo_seed_add_line(v_inv, 12, v_br_main, v_cc, v_wh_main, 'P-BURGER', 25, 2500, 'produce');
  perform public.demo_seed_add_line(v_inv, 13, v_br_main, v_cc, v_wh_main, 'P-MANSAF', 5, 8000, 'produce');
  perform public.demo_seed_add_line(v_inv, 14, v_br_main, v_cc, v_wh_main, 'P-CHICK-R', 10, 3500, 'produce');
  perform public.post_invoice(v_inv);

  -- —— مناقلة بين فرعين: رئيسي → المنصور ——
  insert into public.inventory_transfers (
    transfer_no, from_branch_id, to_branch_id,
    from_warehouse_id, to_warehouse_id, status, notes
  ) values (
    'DEMO-XFER-001', v_br_main, v_br_man,
    v_wh_main, v_wh_man, 'draft',
    'عرض — تزويد فرع المنصور بأطباق جاهزة'
  ) returning id into v_xfer;

  insert into public.inventory_transfer_lines (
    transfer_id, line_no, material_id, material_unit_id, qty_ordered
  )
  select v_xfer, 1, m.id, mu.id, 8
  from public.materials m
  join public.material_units mu on mu.material_id = m.id and mu.is_base_unit
  where m.material_code = 'P-BURGER';

  insert into public.inventory_transfer_lines (
    transfer_id, line_no, material_id, material_unit_id, qty_ordered
  )
  select v_xfer, 2, m.id, mu.id, 3
  from public.materials m
  join public.material_units mu on mu.material_id = m.id and mu.is_base_unit
  where m.material_code = 'P-CHICK-R';

  v_no := 'DEMO-TRO-MAN';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, transfer_transit_account_id,
    inventory_transfer_id, transfer_role,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_tro, v_no, current_date - 4, v_br_main, v_cc,
    v_inv_acct, v_inv_acct,
    v_xfer, 'out',
    'credit', v_cur, 1,
    'عرض — إخراج مناقلة للمنصور',
    'draft'
  ) returning id into v_inv;
  perform public.demo_seed_add_line(v_inv, 1, v_br_main, v_cc, v_wh_main, 'P-BURGER', 8, 2500);
  perform public.demo_seed_add_line(v_inv, 2, v_br_main, v_cc, v_wh_main, 'P-CHICK-R', 3, 3500);
  perform public.post_invoice(v_inv);

  v_no := 'DEMO-TRI-MAN';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    inventory_account_id, transfer_transit_account_id,
    inventory_transfer_id, transfer_role,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_tri, v_no, current_date - 4, v_br_man, v_cc,
    v_inv_acct, v_inv_acct,
    v_xfer, 'in',
    'credit', v_cur, 1,
    'عرض — استلام مناقلة في المنصور',
    'draft'
  ) returning id into v_inv;
  perform public.demo_seed_add_line(v_inv, 1, v_br_man, v_cc, v_wh_man, 'P-BURGER', 8, 2500, null, 8);
  perform public.demo_seed_add_line(v_inv, 2, v_br_man, v_cc, v_wh_man, 'P-CHICK-R', 3, 3500, null, 3);
  perform public.post_invoice(v_inv);

  -- —— مبيعات صالة ——
  v_no := 'DEMO-SAL-001';
  insert into public.invoices (
    pattern_id, invoice_no, invoice_date, branch_id, cost_center_id,
    customer_id, creditor_account_id, debtor_account_id,
    cost_account_id, inventory_account_id,
    settlement_mode, currency_id, exchange_rate, description, status
  ) values (
    v_pat_sal, v_no, current_date - 2, v_br_main,
    (select id from public.cost_centers where code = 'CC-HALL'),
    v_customer, v_sales, v_cash,
    v_cogs, v_inv_acct,
    'cash', v_cur, 1,
    'عرض — مبيعات صالة (برجر + منسف + مشروب)',
    'draft'
  ) returning id into v_inv;
  perform public.demo_seed_add_line(
    v_inv, 1, v_br_main,
    (select id from public.cost_centers where code = 'CC-HALL'),
    v_wh_main, 'P-BURGER', 6, 7500
  );
  perform public.demo_seed_add_line(
    v_inv, 2, v_br_main,
    (select id from public.cost_centers where code = 'CC-HALL'),
    v_wh_main, 'P-MANSAF', 2, 18000
  );
  perform public.demo_seed_add_line(
    v_inv, 3, v_br_main,
    (select id from public.cost_centers where code = 'CC-HALL'),
    v_wh_main, 'M-COLA', 6, 1000
  );
  perform public.post_invoice(v_inv);
end $$;

drop function if exists public.demo_seed_add_line(
  uuid, int, uuid, uuid, uuid, text, numeric, numeric, text, numeric, date
);

-- ---------------------------------------------------------------------------
-- 11) قيود عرض إضافية (إيجار)
-- ---------------------------------------------------------------------------

do $$
declare
  v_je uuid;
  v_rent uuid;
  v_bank uuid;
  v_cur uuid;
  v_br uuid;
begin
  if exists (select 1 from public.journal_entries where entry_no = 'DEMO-RENT-001') then
    return;
  end if;

  select id into v_rent from public.accounts where code = '6102';
  select id into v_bank from public.accounts where code = '1102';
  select id into v_cur from public.currencies where is_base = true;
  select id into v_br from public.branches where branch_code = 'MAIN';

  insert into public.journal_entries (
    entry_no, entry_date, description, status, source_type, branch_id
  ) values (
    'DEMO-RENT-001', current_date - 3,
    'عرض — إيجار المحل الشهري',
    'posted', 'demo', v_br
  ) returning id into v_je;

  insert into public.journal_entry_lines (
    journal_entry_id, account_id, debit, credit, debit_base, credit_base,
    currency_id, exchange_rate, line_description, branch_id
  ) values
    (v_je, v_rent, 1200000, 0, 1200000, 0, v_cur, 1, 'إيجار', v_br),
    (v_je, v_bank, 0, 1200000, 0, 1200000, v_cur, 1, 'تحويل بنكي', v_br);
end $$;

-- =============================================================================
-- اكتمل عرض المطعم
-- =============================================================================
-- سجّل أول مستخدم من /login (يصبح admin) ثم تصفّح:
--   قيد افتتاحي OPEN-YYYY-MAIN · فواتير DEMO-* · مواد R-* (تحضير) و P-* (أطباق)
--   سلسلة التصنيع: ني → متبّل (R-*) → طبق (P-*) · مناقلة تبريد↔مطبخ وبين الفروع
-- لإعادة التثبيت: setup_demo_restaurant.sql
-- =============================================================================
