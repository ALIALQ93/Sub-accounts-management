-- =============================================================================
-- patch_materials_minimal.sql — مواد ومستودعات (الحد الأدنى للفواتير)
-- =============================================================================
-- يتطلب: patch_branches.sql
-- التالي: patch_company_inventory.sql
--
-- نموذج الوحدات: كل مادة لها وحداتها الخاصة (لا جدول وحدات عام مشترك).
--   - وحدة أساسية واحدة per مادة (is_base_unit = true, factor_to_base = 1)
--   - وحدات أخرى: factor_to_base = عدد وحدات الأساس في 1 من هذه الوحدة
--     مثال: أساس=قطعة، علبة=12 → 1 علبة = 12 قطعة
--     مادة أخرى: علبة=10 → التحويل خاص بتلك المادة فقط
-- =============================================================================

-- ---------------------------------------------------------------------------
-- أصناف المواد
-- ---------------------------------------------------------------------------

create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  category_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  parent_id uuid null references public.material_categories(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_categories_parent_not_self check (id is null or id <> parent_id)
);

comment on table public.material_categories is 'تصنيف المواد — شجرة اختيارية';

create index if not exists idx_material_categories_parent_id
  on public.material_categories(parent_id);
create index if not exists idx_material_categories_active
  on public.material_categories(is_active);

-- ---------------------------------------------------------------------------
-- المستودعات (مرتبطة بالفرع)
-- ---------------------------------------------------------------------------

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.warehouses is 'مستودعات التخزين — كل مستودع تابع لفرع واحد';

create index if not exists idx_warehouses_branch_id on public.warehouses(branch_id);
create index if not exists idx_warehouses_active on public.warehouses(is_active);

alter table public.branches
  drop constraint if exists branches_default_warehouse_id_fkey;

alter table public.branches
  add constraint branches_default_warehouse_id_fkey
  foreign key (default_warehouse_id) references public.warehouses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- بطاقة المادة (minimal) — الأسعار per الوحدة الأساسية
-- ---------------------------------------------------------------------------

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  material_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  category_id uuid null references public.material_categories(id) on delete set null,
  purchase_price numeric(18, 4) not null default 0 check (purchase_price >= 0),
  sale_price numeric(18, 4) not null default 0 check (sale_price >= 0),
  inventory_account_id uuid null references public.accounts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.materials is 'بطاقة مادة — purchase_price/sale_price per الوحدة الأساسية';
comment on column public.materials.purchase_price is 'سعر الشراء لوحدة الأساس';
comment on column public.materials.sale_price is 'سعر البيع لوحدة الأساس';

create index if not exists idx_materials_category_id on public.materials(category_id);
create index if not exists idx_materials_inventory_account_id on public.materials(inventory_account_id);
create index if not exists idx_materials_active on public.materials(is_active);

-- ---------------------------------------------------------------------------
-- وحدات المادة — معرّفة per مادة (لا تتكرر عالمياً)
-- ---------------------------------------------------------------------------

create table if not exists public.material_units (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  unit_code varchar(30) not null,
  name_ar varchar(100) not null,
  name_en varchar(100) null,
  is_base_unit boolean not null default false,
  factor_to_base numeric(18, 6) not null check (factor_to_base > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, unit_code),
  constraint material_units_base_factor check (
    not is_base_unit or factor_to_base = 1
  )
);

comment on table public.material_units is
  'وحدات قياس خاصة بكل مادة — التحويل للأساس: qty_base = qty × factor_to_base';
comment on column public.material_units.factor_to_base is
  '1 من هذه الوحدة = factor_to_base من وحدة الأساس (العلبة 12 → factor_to_base = 12)';

create unique index if not exists idx_material_units_one_base_per_material
  on public.material_units (material_id)
  where is_base_unit = true;

create index if not exists idx_material_units_material_id
  on public.material_units(material_id);
create index if not exists idx_material_units_active
  on public.material_units(material_id, is_active);

-- ---------------------------------------------------------------------------
-- تحويل الكمية إلى وحدة الأساس
-- ---------------------------------------------------------------------------

create or replace function public.material_quantity_to_base(
  p_material_unit_id uuid,
  p_quantity numeric
)
returns numeric
language sql
stable
as $$
  select round((p_quantity * mu.factor_to_base)::numeric, 6)
  from public.material_units mu
  where mu.id = p_material_unit_id;
$$;

comment on function public.material_quantity_to_base(uuid, numeric) is
  'يحوّل كمية من وحدة المادة إلى مكافئ وحدة الأساس (ضرب factor_to_base)';

create or replace function public.material_quantity_from_base(
  p_material_unit_id uuid,
  p_quantity_base numeric
)
returns numeric
language sql
stable
as $$
  select round((p_quantity_base / mu.factor_to_base)::numeric, 6)
  from public.material_units mu
  where mu.id = p_material_unit_id
    and mu.factor_to_base > 0;
$$;

comment on function public.material_quantity_from_base(uuid, numeric) is
  'يحوّل من وحدة الأساس إلى وحدة أخرى (قسمة factor_to_base)';

-- ---------------------------------------------------------------------------
-- تحقق: وحدة أساس واحدة + factor صحيح
-- ---------------------------------------------------------------------------

create or replace function public.material_units_validate()
returns trigger
language plpgsql
as $$
declare
  v_base_count int;
begin
  if new.is_base_unit then
    new.factor_to_base := 1;
  elsif new.factor_to_base = 1 and not new.is_base_unit then
    raise exception 'Only the base unit may have factor_to_base = 1.';
  end if;

  if tg_op = 'INSERT' or new.is_base_unit is distinct from old.is_base_unit then
    select count(*)
    into v_base_count
    from public.material_units mu
    where mu.material_id = new.material_id
      and mu.is_base_unit = true
      and mu.id is distinct from new.id;

    if new.is_base_unit and v_base_count > 0 then
      raise exception 'Material already has a base unit.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.materials_require_base_unit()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.material_units mu
    where mu.material_id = new.id
      and mu.is_base_unit = true
  ) then
    raise exception 'Material must have exactly one base unit defined in material_units.';
  end if;
  return new;
end;
$$;

-- يُفعَّل عند الحاجة — لا نمنع إنشاء مادة قبل إضافة وحداتها في نفس المعاملة
-- (التحقق في التطبيق عند «اكتمال البطاقة» أو قبل أول فاتورة)

-- ---------------------------------------------------------------------------
-- بذور أولية
-- ---------------------------------------------------------------------------

insert into public.material_categories (category_code, name_ar, name_en)
select 'GENERAL', 'عام', 'General'
where not exists (select 1 from public.material_categories);

insert into public.warehouses (warehouse_code, name_ar, name_en, branch_id)
select 'WH-MAIN', 'المستودع الرئيسي', 'Main Warehouse', b.id
from public.branches b
where b.branch_code = 'MAIN'
  and not exists (
    select 1 from public.warehouses w where w.warehouse_code = 'WH-MAIN'
  );

update public.branches b
set default_warehouse_id = w.id
from public.warehouses w
where b.branch_code = 'MAIN'
  and w.warehouse_code = 'WH-MAIN'
  and b.default_warehouse_id is null;

-- ---------------------------------------------------------------------------
-- محفزات
-- ---------------------------------------------------------------------------

drop trigger if exists trg_material_categories_updated_at on public.material_categories;
create trigger trg_material_categories_updated_at
before update on public.material_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_warehouses_updated_at on public.warehouses;
create trigger trg_warehouses_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

drop trigger if exists trg_materials_updated_at on public.materials;
create trigger trg_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists trg_material_units_updated_at on public.material_units;
create trigger trg_material_units_updated_at
before update on public.material_units
for each row execute function public.set_updated_at();

drop trigger if exists trg_material_units_validate on public.material_units;
create trigger trg_material_units_validate
before insert or update on public.material_units
for each row execute function public.material_units_validate();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.material_categories enable row level security;
alter table public.warehouses enable row level security;
alter table public.materials enable row level security;
alter table public.material_units enable row level security;

drop policy if exists "material_categories_select_all" on public.material_categories;
create policy "material_categories_select_all" on public.material_categories
  for select to anon, authenticated using (true);
drop policy if exists "material_categories_insert_all" on public.material_categories;
create policy "material_categories_insert_all" on public.material_categories
  for insert to anon, authenticated with check (true);
drop policy if exists "material_categories_update_all" on public.material_categories;
create policy "material_categories_update_all" on public.material_categories
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "warehouses_select_all" on public.warehouses;
create policy "warehouses_select_all" on public.warehouses
  for select to anon, authenticated using (true);
drop policy if exists "warehouses_insert_all" on public.warehouses;
create policy "warehouses_insert_all" on public.warehouses
  for insert to anon, authenticated with check (true);
drop policy if exists "warehouses_update_all" on public.warehouses;
create policy "warehouses_update_all" on public.warehouses
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "materials_select_all" on public.materials;
create policy "materials_select_all" on public.materials
  for select to anon, authenticated using (true);
drop policy if exists "materials_insert_all" on public.materials;
create policy "materials_insert_all" on public.materials
  for insert to anon, authenticated with check (true);
drop policy if exists "materials_update_all" on public.materials;
create policy "materials_update_all" on public.materials
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "material_units_select_all" on public.material_units;
create policy "material_units_select_all" on public.material_units
  for select to anon, authenticated using (true);
drop policy if exists "material_units_insert_all" on public.material_units;
create policy "material_units_insert_all" on public.material_units
  for insert to anon, authenticated with check (true);
drop policy if exists "material_units_update_all" on public.material_units;
create policy "material_units_update_all" on public.material_units
  for update to anon, authenticated using (true) with check (true);
