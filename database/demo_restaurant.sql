-- =============================================================================
-- demo_restaurant.sql — بيانات عرض جاهزة لمطعم (بعد setup_all)
-- =============================================================================
-- الاستخدام:
--   1) شغّل database/setup_all.sql أولاً (أو استخدم setup_demo_restaurant.sql)
--   2) ثم شغّل هذا الملف في Supabase SQL Editor
--
-- ماذا يوفّر:
--   شركة مطعم تجريبية، دليل حسابات، فروع/مستودعات، مراكز كلفة،
--   أصناف ومواد (مطبخ)، عملاء/موردين، إعداد مخزون، فترة محاسبية،
--   ربط أنماط الفواتير، نقطة بيع، رصيد افتتاحي مخزون، وقيود عرض.
--
-- ملاحظة: لا يستدعي post_invoice (يتطلب مستخدماً مسجّلاً) — القيود/الحركات
-- تُدرج مباشرة للعرض الفوري بعد تسجيل أول مدير من الواجهة.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from public.company_settings
    where id = 1 and legal_name_ar = 'مطعم الباب الذهبي'
  ) then
    raise exception
      'demo_restaurant: already applied. Re-run setup_all.sql (or setup_demo_restaurant.sql) to reset first.';
  end if;

  if not exists (select 1 from public.accounts where code = '1') then
    raise exception 'demo_restaurant: run setup_all.sql first (root accounts missing).';
  end if;
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
    ('PACK', 'تغليف وتوصيل', 'Packaging')
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

  -- أطباق جاهزة للبيع (أسعار بيع)
  if not exists (select 1 from public.materials where material_code = 'P-MANSAF') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'P-MANSAF', 'منسف غنم (طبق)', 'Lamb mansaf plate', v_cat_meat,
      8000, 18000, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'P-GRILL') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'P-GRILL', 'مشاوي مشكلة (طبق)', 'Mixed grill plate', v_cat_meat,
      7000, 16000, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;

  if not exists (select 1 from public.materials where material_code = 'P-CHICK-R') then
    insert into public.materials (
      material_code, name_ar, name_en, category_id,
      purchase_price, sale_price, inventory_account_id, is_active
    ) values (
      'P-CHICK-R', 'دجاج رز (طبق)', 'Chicken rice plate', v_cat_meat,
      3500, 9000, v_inv_food, true
    ) returning id into v_mat;
    insert into public.material_units (
      material_id, unit_code, name_ar, is_base_unit, factor_to_base,
      conversion_op, conversion_factor, sort_order
    ) values (v_mat, 'PC', 'طبق', true, 1, 'multiply', 1, 0);
  end if;
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

insert into public.pos_point_payment_methods (
  pos_point_id, account_id, label_ar, label_en, is_default, sort_order, is_active
)
select
  pp.id,
  a.id,
  x.label_ar,
  x.label_en,
  x.is_default,
  x.sort_order,
  true
from public.pos_points pp
cross join (
  values
    ('نقداً', 'Cash', '1101', true, 1),
    ('بطاقة', 'Card', '1102', false, 2)
) as x(label_ar, label_en, account_code, is_default, sort_order)
join public.accounts a on a.code = x.account_code
where pp.point_code = 'POS-HALL'
  and not exists (
    select 1 from public.pos_point_payment_methods pm
    where pm.pos_point_id = pp.id and pm.account_id = a.id
  );

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
             when 'P-MANSAF' then 20
             when 'P-GRILL' then 20
             when 'P-CHICK-R' then 30
             else 10
           end as qty
    from public.materials m
    where m.material_code like 'M-%' or m.material_code like 'P-%'
  loop
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

  perform public.lock_company_inventory_foundation((current_date - 7)::timestamptz);
end $$;

-- ---------------------------------------------------------------------------
-- 10) قيود عرض (مبيعات نقدية + مصروف إيجار)
-- ---------------------------------------------------------------------------

do $$
declare
  v_je uuid;
  v_cash uuid;
  v_sales uuid;
  v_rent uuid;
  v_bank uuid;
  v_cur uuid;
  v_br uuid;
begin
  if exists (select 1 from public.journal_entries where entry_no = 'DEMO-SALE-001') then
    return;
  end if;

  select id into v_cash from public.accounts where code = '1101';
  select id into v_sales from public.accounts where code = '4101';
  select id into v_rent from public.accounts where code = '6102';
  select id into v_bank from public.accounts where code = '1102';
  select id into v_cur from public.currencies where is_base = true;
  select id into v_br from public.branches where branch_code = 'MAIN';

  insert into public.journal_entries (
    entry_no, entry_date, description, status, source_type, branch_id
  ) values (
    'DEMO-SALE-001', current_date - 1,
    'عرض — مبيعات صالة نقدية (يوم تجريبي)',
    'posted', 'demo', v_br
  ) returning id into v_je;

  insert into public.journal_entry_lines (
    journal_entry_id, account_id, debit, credit, debit_base, credit_base,
    currency_id, exchange_rate, line_description, branch_id
  ) values
    (v_je, v_cash, 450000, 0, 450000, 0, v_cur, 1, 'تحصيل كاشير', v_br),
    (v_je, v_sales, 0, 450000, 0, 450000, v_cur, 1, 'مبيعات أطباق', v_br);

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
--   المواد، المستودعات، أرصدة المخزون، القيود، نقطة البيع، أنماط الفواتير.
-- لإعادة التثبيت من الصفر: setup_all.sql ثم هذا الملف، أو setup_demo_restaurant.sql
-- =============================================================================
