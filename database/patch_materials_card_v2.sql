-- =============================================================================
-- patch_materials_card_v2.sql (#43)
-- =============================================================================
-- بطاقة مادة محسّنة:
--   1) كتالوج وحدات عالمي (units) + ربط material_units مع ضرب/قسمة
--   2) نوع المادة: عادية | تجميعية + مكوّنات BOM
--   3) رمز مادة مقترح يتبع رمز الصنف
--   4) عند حركة مخزون لمادة تجميعية → استهلاك/إدخال المكوّنات العادية
-- يتطلب: patch_create_material_with_base_unit.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) كتالوج الوحدات العالمي
-- ---------------------------------------------------------------------------

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  unit_code varchar(30) not null unique,
  name_ar varchar(100) not null,
  name_en varchar(100) null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.units is
  'كتالوج وحدات قياس مشترك — التحويل الفعلي يُعرَّف per مادة في material_units';

create index if not exists idx_units_active on public.units(is_active);

alter table public.units enable row level security;

drop policy if exists units_select_authenticated on public.units;
create policy units_select_authenticated
  on public.units for select to authenticated
  using (true);

drop policy if exists units_write_authenticated on public.units;
create policy units_write_authenticated
  on public.units for all to authenticated
  using (true)
  with check (true);

-- بذر وحدات شائعة من الوحدات الحالية (إن وُجدت)
insert into public.units (unit_code, name_ar, name_en, is_active)
select distinct
  upper(trim(mu.unit_code)),
  min(mu.name_ar),
  nullif(min(coalesce(mu.name_en, '')), ''),
  true
from public.material_units mu
where coalesce(nullif(trim(mu.unit_code), ''), '') <> ''
group by upper(trim(mu.unit_code))
on conflict (unit_code) do nothing;

insert into public.units (unit_code, name_ar, name_en, is_active)
values
  ('PCS', 'قطعة', 'Piece', true),
  ('BOX', 'علبة', 'Box', true),
  ('KG', 'كيلو', 'Kilogram', true),
  ('G', 'غرام', 'Gram', true),
  ('L', 'لتر', 'Liter', true),
  ('M', 'متر', 'Meter', true)
on conflict (unit_code) do nothing;

-- ---------------------------------------------------------------------------
-- 2) توسيع material_units: ربط بالكتالوج + ضرب/قسمة
-- ---------------------------------------------------------------------------

alter table public.material_units
  add column if not exists unit_id uuid null references public.units(id) on delete set null;

alter table public.material_units
  add column if not exists conversion_op varchar(10) not null default 'multiply';

alter table public.material_units
  add column if not exists conversion_factor numeric(18, 6) not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'material_units_conversion_op_chk'
  ) then
    alter table public.material_units
      add constraint material_units_conversion_op_chk
      check (conversion_op in ('multiply', 'divide'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'material_units_conversion_factor_chk'
  ) then
    alter table public.material_units
      add constraint material_units_conversion_factor_chk
      check (conversion_factor > 0);
  end if;
end $$;

comment on column public.material_units.unit_id is 'مرجع اختياري لكتالوج الوحدات';
comment on column public.material_units.conversion_op is
  'multiply: qty_base = qty × factor | divide: qty_base = qty ÷ factor';
comment on column public.material_units.conversion_factor is
  'معامل الضرب أو القسمة الذي يحدده المستخدم (الوحدة الأساس: 1 ×)';

-- مزامنة factor_to_base من الضرب/القسمة + تعبئة unit_id عند الإمكان
create or replace function public.material_units_sync_conversion()
returns trigger
language plpgsql
as $$
declare
  v_unit public.units%rowtype;
begin
  if new.unit_id is not null then
    select * into v_unit from public.units where id = new.unit_id;
    if not found then
      raise exception 'Unit catalog entry not found.';
    end if;
    new.unit_code := upper(trim(v_unit.unit_code));
    if coalesce(nullif(trim(new.name_ar), ''), '') = '' then
      new.name_ar := v_unit.name_ar;
    end if;
    if new.name_en is null then
      new.name_en := v_unit.name_en;
    end if;
  end if;

  if new.is_base_unit then
    new.conversion_op := 'multiply';
    new.conversion_factor := 1;
    new.factor_to_base := 1;
  else
    if coalesce(new.conversion_factor, 0) <= 0 then
      raise exception 'conversion_factor must be > 0.';
    end if;
    if new.conversion_op = 'divide' then
      new.factor_to_base := round((1 / new.conversion_factor)::numeric, 6);
    else
      new.conversion_op := 'multiply';
      new.factor_to_base := round(new.conversion_factor::numeric, 6);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_material_units_sync_conversion on public.material_units;
create trigger trg_material_units_sync_conversion
  before insert or update on public.material_units
  for each row
  execute function public.material_units_sync_conversion();

-- تعبئة رجعية: conversion من factor_to_base + ربط unit_id بالرمز
update public.material_units mu
set
  conversion_op = 'multiply',
  conversion_factor = case when mu.is_base_unit then 1 else mu.factor_to_base end,
  unit_id = coalesce(
    mu.unit_id,
    (select u.id from public.units u where u.unit_code = upper(trim(mu.unit_code)) limit 1)
  )
where true;

-- ---------------------------------------------------------------------------
-- 3) نوع المادة + مكوّنات التجميع (BOM)
-- ---------------------------------------------------------------------------

alter table public.materials
  add column if not exists material_kind varchar(20) not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'materials_material_kind_chk'
  ) then
    alter table public.materials
      add constraint materials_material_kind_chk
      check (material_kind in ('normal', 'composite'));
  end if;
end $$;

comment on column public.materials.material_kind is
  'normal = مادة عادية بمخزون | composite = تجميعية تستهلك مكوّنات عند الحركة';

create table if not exists public.material_bom_components (
  id uuid primary key default gen_random_uuid(),
  parent_material_id uuid not null references public.materials(id) on delete cascade,
  component_material_id uuid not null references public.materials(id) on delete restrict,
  quantity numeric(18, 6) not null check (quantity > 0),
  component_unit_id uuid null references public.material_units(id) on delete restrict,
  quantity_base numeric(18, 6) not null check (quantity_base > 0),
  sort_order int not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_material_id, component_material_id),
  constraint material_bom_not_self check (parent_material_id <> component_material_id)
);

comment on table public.material_bom_components is
  'مكوّنات المادة التجميعية — الكمية لكل 1 وحدة أساس من الأب';
comment on column public.material_bom_components.quantity_base is
  'كمية المكوّن بوحدة الأساس لكل 1 وحدة أساس من المادة التجميعية';

create index if not exists idx_material_bom_parent
  on public.material_bom_components(parent_material_id);
create index if not exists idx_material_bom_component
  on public.material_bom_components(component_material_id);

alter table public.material_bom_components enable row level security;

drop policy if exists material_bom_select_authenticated on public.material_bom_components;
create policy material_bom_select_authenticated
  on public.material_bom_components for select to authenticated
  using (true);

drop policy if exists material_bom_write_authenticated on public.material_bom_components;
create policy material_bom_write_authenticated
  on public.material_bom_components for all to authenticated
  using (true)
  with check (true);

create or replace function public.material_bom_components_validate()
returns trigger
language plpgsql
as $$
declare
  v_parent_kind varchar(20);
  v_comp_kind varchar(20);
  v_qty_base numeric(18, 6);
begin
  select material_kind into v_parent_kind
  from public.materials where id = new.parent_material_id;

  if v_parent_kind is distinct from 'composite' then
    raise exception 'BOM components are only allowed on composite materials.';
  end if;

  select material_kind into v_comp_kind
  from public.materials where id = new.component_material_id;

  if v_comp_kind is distinct from 'normal' then
    raise exception 'BOM component must be a normal material.';
  end if;

  if new.component_unit_id is not null then
    if not exists (
      select 1 from public.material_units mu
      where mu.id = new.component_unit_id
        and mu.material_id = new.component_material_id
        and mu.is_active
    ) then
      raise exception 'component_unit_id must belong to the component material.';
    end if;
    v_qty_base := public.material_quantity_to_base(new.component_unit_id, new.quantity);
  else
    v_qty_base := new.quantity;
  end if;

  if coalesce(v_qty_base, 0) <= 0 then
    raise exception 'BOM quantity_base must be > 0.';
  end if;

  new.quantity_base := round(v_qty_base::numeric, 6);
  return new;
end;
$$;

drop trigger if exists trg_material_bom_components_validate
  on public.material_bom_components;
create trigger trg_material_bom_components_validate
  before insert or update on public.material_bom_components
  for each row
  execute function public.material_bom_components_validate();

-- منع تحويل مادة لها مكوّنات إلى عادية دون حذف المكوّنات
create or replace function public.materials_kind_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.material_kind = 'composite'
     and new.material_kind = 'normal'
     and exists (
       select 1 from public.material_bom_components b
       where b.parent_material_id = new.id
     ) then
    raise exception 'Remove BOM components before changing material kind to normal.';
  end if;

  if new.material_kind = 'composite'
     and exists (
       select 1 from public.material_bom_components b
       where b.component_material_id = new.id
     ) then
    raise exception 'A material used as a BOM component cannot become composite.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_materials_kind_guard on public.materials;
create trigger trg_materials_kind_guard
  before update on public.materials
  for each row
  execute function public.materials_kind_guard();

-- ---------------------------------------------------------------------------
-- 4) اقتراح رمز المادة من رمز الصنف
-- ---------------------------------------------------------------------------

create or replace function public.suggest_next_material_code(p_category_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_code text;
  v_n int;
  v_candidate text;
begin
  if p_category_id is not null then
    select upper(trim(category_code)) into v_prefix
    from public.material_categories
    where id = p_category_id;
  end if;

  if coalesce(v_prefix, '') = '' then
    v_prefix := 'MAT';
  end if;

  -- أعلى لاحقة رقمية لنفس البادئة (PREFIX-### أو PREFIX###)
  select coalesce(max(
    case
      when material_code ~ ('^' || v_prefix || '[-_]?[0-9]+$') then
        substring(material_code from '[0-9]+$')::int
      else 0
    end
  ), 0)
  into v_n
  from public.materials
  where material_code ilike v_prefix || '%';

  for v_n in v_n + 1 .. v_n + 10000 loop
    v_candidate := v_prefix || '-' || lpad(v_n::text, 4, '0');
    if not exists (
      select 1 from public.materials m where m.material_code = v_candidate
    ) then
      return v_candidate;
    end if;
  end loop;

  return v_prefix || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS');
end;
$$;

comment on function public.suggest_next_material_code(uuid) is
  'يقترح رمز مادة يتبع رمز الصنف (مثلاً CAT-0001) — قابل للتعديل من الواجهة';

grant execute on function public.suggest_next_material_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) تفكيك التجميعية عند حركة المخزون
-- ---------------------------------------------------------------------------

create or replace function public.explode_material_bom(
  p_material_id uuid,
  p_quantity_base numeric
)
returns table (
  component_material_id uuid,
  quantity_base numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
begin
  select material_kind into v_kind
  from public.materials where id = p_material_id;

  if v_kind is distinct from 'composite' then
    component_material_id := p_material_id;
    quantity_base := p_quantity_base;
    return next;
    return;
  end if;

  if not exists (
    select 1 from public.material_bom_components b
    where b.parent_material_id = p_material_id
  ) then
    raise exception 'Composite material has no BOM components.';
  end if;

  return query
  select
    b.component_material_id,
    round((b.quantity_base * p_quantity_base)::numeric, 6)
  from public.material_bom_components b
  where b.parent_material_id = p_material_id
  order by b.sort_order, b.created_at;
end;
$$;

grant execute on function public.explode_material_bom(uuid, numeric) to authenticated;

-- منع التكرار اللانهائي عند الإدراج المتعدد من الـ trigger
create or replace function public.inventory_movements_explode_composite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
  v_comp record;
  v_sign numeric;
  v_abs_base numeric;
  v_ratio numeric;
begin
  if current_setting('app.bom_explode_depth', true) = '1' then
    return new;
  end if;

  select material_kind into v_kind
  from public.materials where id = new.material_id;

  if v_kind is distinct from 'composite' then
    return new;
  end if;

  v_abs_base := abs(coalesce(new.quantity_base_delta, 0));
  if v_abs_base = 0 then
    return null;
  end if;

  v_sign := case when new.quantity_base_delta < 0 then -1 else 1 end;
  v_ratio := case
    when abs(coalesce(new.quantity_delta, 0)) > 0
         and abs(coalesce(new.quantity_base_delta, 0)) > 0
    then abs(new.quantity_delta) / abs(new.quantity_base_delta)
    else 1
  end;

  perform set_config('app.bom_explode_depth', '1', true);

  for v_comp in
    select * from public.explode_material_bom(new.material_id, v_abs_base)
  loop
    insert into public.inventory_movements (
      movement_date,
      material_id,
      warehouse_id,
      branch_id,
      cost_center_id,
      quantity_delta,
      quantity_base_delta,
      unit_cost,
      total_cost,
      movement_kind,
      source_type,
      source_id,
      source_line_id,
      expiry_date,
      serial_number
    )
    values (
      new.movement_date,
      v_comp.component_material_id,
      new.warehouse_id,
      new.branch_id,
      new.cost_center_id,
      round((v_sign * v_comp.quantity_base * v_ratio)::numeric, 6),
      round((v_sign * v_comp.quantity_base)::numeric, 6),
      new.unit_cost,
      round((abs(v_comp.quantity_base) * coalesce(new.unit_cost, 0))::numeric, 2)
        * case when v_sign < 0 then -1 else 1 end,
      new.movement_kind,
      new.source_type,
      new.source_id,
      new.source_line_id,
      new.expiry_date,
      new.serial_number
    );
  end loop;

  perform set_config('app.bom_explode_depth', '', true);

  -- إلغاء إدراج حركة المادة التجميعية نفسها
  return null;
end;
$$;

drop trigger if exists trg_inventory_movements_explode_composite
  on public.inventory_movements;
drop trigger if exists trg_inventory_movements_00_explode_composite
  on public.inventory_movements;
-- الاسم يبدأ بـ 00 ليُنفَّذ قبل enforce_stock / apply_cost
create trigger trg_inventory_movements_00_explode_composite
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_explode_composite();

-- تكلفة مادة عادية (المنطق السابق) ثم غلاف يدعم التجميعية
-- أسماء المعاملات مطابقة للدالة الأصلية في patch_invoice_pricing_cost
create or replace function public.calc_outbound_line_total_cost_normal(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return round((
    abs(coalesce(p_quantity_base, 0))
    * public.calc_outbound_unit_cost(
      p_consumed_mode,
      p_settings,
      p_material_purchase_price,
      p_line_unit_price,
      p_factor_to_base,
      p_material_id,
      p_warehouse_id,
      p_cost_center_id,
      p_expiry_date,
      p_serial_number,
      p_as_of_date
    )
  )::numeric, 2);
end;
$$;

drop function if exists public.calc_outbound_line_total_cost(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
);

create function public.calc_outbound_line_total_cost(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
  v_total numeric(18, 2) := 0;
  v_comp record;
  v_comp_price numeric;
begin
  select material_kind into v_kind
  from public.materials where id = p_material_id;

  if v_kind = 'composite' then
    for v_comp in
      select * from public.explode_material_bom(p_material_id, abs(coalesce(p_quantity_base, 0)))
    loop
      select purchase_price into v_comp_price
      from public.materials where id = v_comp.component_material_id;

      v_total := v_total + public.calc_outbound_line_total_cost_normal(
        p_consumed_mode,
        p_settings,
        coalesce(v_comp_price, 0),
        p_line_unit_price,
        1,
        v_comp.quantity_base,
        v_comp.component_material_id,
        p_warehouse_id,
        p_cost_center_id,
        p_expiry_date,
        p_serial_number,
        p_as_of_date
      );
    end loop;
    return round(v_total::numeric, 2);
  end if;

  return public.calc_outbound_line_total_cost_normal(
    p_consumed_mode,
    p_settings,
    p_material_purchase_price,
    p_line_unit_price,
    p_factor_to_base,
    p_quantity_base,
    p_material_id,
    p_warehouse_id,
    p_cost_center_id,
    p_expiry_date,
    p_serial_number,
    p_as_of_date
  );
end;
$$;

grant execute on function public.calc_outbound_line_total_cost(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
) to authenticated;

grant execute on function public.calc_outbound_line_total_cost_normal(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
) to authenticated;

-- تحديث إنشاء المادة ليشمل material_kind
create or replace function public.create_material_with_base_unit(
  p_material jsonb,
  p_base_unit jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material_id uuid;
  v_unit_code text;
  v_unit_name text;
  v_unit_id uuid;
  v_kind text;
begin
  if coalesce(nullif(trim(p_material->>'material_code'), ''), '') = '' then
    raise exception 'material_code is required.';
  end if;
  if coalesce(nullif(trim(p_material->>'name_ar'), ''), '') = '' then
    raise exception 'name_ar is required.';
  end if;

  v_kind := coalesce(nullif(trim(p_material->>'material_kind'), ''), 'normal');
  if v_kind not in ('normal', 'composite') then
    raise exception 'material_kind must be normal or composite.';
  end if;

  v_unit_id := nullif(p_base_unit->>'unit_id', '')::uuid;
  v_unit_code := upper(trim(coalesce(p_base_unit->>'unit_code', '')));
  v_unit_name := trim(coalesce(p_base_unit->>'name_ar', ''));

  if v_unit_id is not null then
    select unit_code, name_ar
    into v_unit_code, v_unit_name
    from public.units where id = v_unit_id;
  end if;

  if v_unit_code = '' or v_unit_name = '' then
    raise exception 'Base unit code and name_ar are required.';
  end if;

  insert into public.materials (
    material_code,
    name_ar,
    name_en,
    category_id,
    purchase_price,
    sale_price,
    inventory_account_id,
    is_active,
    min_stock,
    max_stock,
    barcode,
    manufacturer,
    supplier_name,
    color,
    size,
    weight,
    notes,
    has_expiry_date,
    require_expiry_on_inbound,
    require_expiry_on_outbound,
    expiry_days,
    has_serial_number,
    require_serial_on_inbound,
    require_serial_on_outbound,
    material_kind
  )
  values (
    upper(trim(p_material->>'material_code')),
    trim(p_material->>'name_ar'),
    nullif(trim(coalesce(p_material->>'name_en', '')), ''),
    nullif(p_material->>'category_id', '')::uuid,
    coalesce((p_material->>'purchase_price')::numeric, 0),
    coalesce((p_material->>'sale_price')::numeric, 0),
    nullif(p_material->>'inventory_account_id', '')::uuid,
    coalesce((p_material->>'is_active')::boolean, true),
    coalesce((p_material->>'min_stock')::numeric, 0),
    coalesce((p_material->>'max_stock')::numeric, 0),
    nullif(trim(coalesce(p_material->>'barcode', '')), ''),
    nullif(trim(coalesce(p_material->>'manufacturer', '')), ''),
    nullif(trim(coalesce(p_material->>'supplier_name', '')), ''),
    nullif(trim(coalesce(p_material->>'color', '')), ''),
    nullif(trim(coalesce(p_material->>'size', '')), ''),
    nullif(p_material->>'weight', '')::numeric,
    nullif(trim(coalesce(p_material->>'notes', '')), ''),
    coalesce((p_material->>'has_expiry_date')::boolean, false),
    coalesce((p_material->>'require_expiry_on_inbound')::boolean, false),
    coalesce((p_material->>'require_expiry_on_outbound')::boolean, false),
    null,
    coalesce((p_material->>'has_serial_number')::boolean, false),
    coalesce((p_material->>'require_serial_on_inbound')::boolean, false),
    coalesce((p_material->>'require_serial_on_outbound')::boolean, false),
    v_kind
  )
  returning id into v_material_id;

  insert into public.material_units (
    material_id,
    unit_id,
    unit_code,
    name_ar,
    name_en,
    is_base_unit,
    conversion_op,
    conversion_factor,
    factor_to_base,
    is_active,
    purchase_price,
    sale_price,
    semi_wholesale_price,
    wholesale_price,
    sort_order
  )
  values (
    v_material_id,
    v_unit_id,
    v_unit_code,
    v_unit_name,
    nullif(trim(coalesce(p_base_unit->>'name_en', '')), ''),
    true,
    'multiply',
    1,
    1,
    coalesce((p_base_unit->>'is_active')::boolean, true),
    coalesce(
      nullif(p_base_unit->>'purchase_price', '')::numeric,
      (p_material->>'purchase_price')::numeric
    ),
    coalesce(
      nullif(p_base_unit->>'sale_price', '')::numeric,
      (p_material->>'sale_price')::numeric
    ),
    nullif(p_base_unit->>'semi_wholesale_price', '')::numeric,
    nullif(p_base_unit->>'wholesale_price', '')::numeric,
    0
  );

  return v_material_id;
end;
$$;

grant execute on function public.create_material_with_base_unit(jsonb, jsonb)
  to authenticated;
