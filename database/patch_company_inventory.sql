-- =============================================================================
-- patch_company_inventory.sql — إعدادات الجرد والتكلفة (قفل عند أول عملية)
-- =============================================================================
-- يتطلب: patch_materials_minimal.sql
-- التالي: patch_invoices.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- إعدادات المخزون والتكلفة — صف واحد per شركة (مثل party_settings)
-- ---------------------------------------------------------------------------

create table if not exists public.company_inventory_settings (
  id int primary key default 1 check (id = 1),

  -- ② طريقة الجرد (مقفول بعد foundation_locked)
  inventory_method varchar(20) null
    check (inventory_method is null or inventory_method in ('periodic', 'perpetual')),

  -- ③ نظام التكلفة (مقفول)
  costing_method varchar(30) null
    check (costing_method is null or costing_method in (
      'weighted_avg', 'fifo', 'standard', 'last_purchase'
    )),

  cost_per_warehouse boolean not null default false,
  cost_per_cost_center boolean not null default false,

  -- دائماً true per قرار المنتج #21 — احتساب مخزون مع كل حركة
  track_quantity_on_movement boolean not null default true
    check (track_quantity_on_movement = true),

  -- قفل الإعدادات الأولية (معالج التثبيت أو أول ترحيل مخزني)
  foundation_locked boolean not null default false,
  foundation_locked_at timestamptz null,
  first_posted_inventory_at timestamptz null,

  updated_at timestamptz not null default now()
);

comment on table public.company_inventory_settings is
  'إعدادات الجرد والتكلفة — تُختار في المعالج الأولي وتُقفَل بعد أول عملية مخزنية مرحّلة';
comment on column public.company_inventory_settings.inventory_method is
  'periodic = جرد دوري | perpetual = جرد مستمر — يحدد شكل قيود المبيعات/المناقلة';
comment on column public.company_inventory_settings.costing_method is
  'weighted_avg | fifo | standard | last_purchase';
comment on column public.company_inventory_settings.foundation_locked is
  'عند true: لا تعديل على inventory_method, costing_method, cost_per_*';

insert into public.company_inventory_settings (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- منع تعديل الحقول المقفولة
-- ---------------------------------------------------------------------------

create or replace function public.company_inventory_settings_guard_locked()
returns trigger
language plpgsql
as $$
begin
  if old.foundation_locked and (
    new.inventory_method is distinct from old.inventory_method
    or new.costing_method is distinct from old.costing_method
    or new.cost_per_warehouse is distinct from old.cost_per_warehouse
    or new.cost_per_cost_center is distinct from old.cost_per_cost_center
    or new.track_quantity_on_movement is distinct from old.track_quantity_on_movement
  ) then
    raise exception
      'Inventory foundation settings are locked. Cannot change inventory_method, costing_method, or cost separation.';
  end if;

  if new.foundation_locked and not old.foundation_locked then
    new.foundation_locked_at := coalesce(new.foundation_locked_at, now());
  end if;

  if new.foundation_locked and old.foundation_locked
     and new.foundation_locked_at is distinct from old.foundation_locked_at then
    -- السماح بتعيين أول مرة فقط
    if old.foundation_locked_at is not null then
      new.foundation_locked_at := old.foundation_locked_at;
    end if;
  end if;

  return new;
end;
$$;

-- يُستدعى لاحقاً عند أول فاتورة/حركة مخزنية مرحّلة
create or replace function public.lock_company_inventory_foundation(
  p_first_posted_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.company_inventory_settings
  set
    foundation_locked = true,
    foundation_locked_at = coalesce(foundation_locked_at, p_first_posted_at),
    first_posted_inventory_at = coalesce(first_posted_inventory_at, p_first_posted_at)
  where id = 1
    and not foundation_locked;
end;
$$;

comment on function public.lock_company_inventory_foundation(timestamptz) is
  'يُقفل إعدادات الجرد/التكلفة بعد أول عملية مخزنية مرحّلة';

-- قراءة الإعدادات (للتطبيق والترحيل لاحقاً)
create or replace function public.get_company_inventory_settings()
returns public.company_inventory_settings
language sql
stable
security definer
set search_path = public
as $$
  select cis.*
  from public.company_inventory_settings cis
  where cis.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- محفزات
-- ---------------------------------------------------------------------------

drop trigger if exists trg_company_inventory_settings_updated_at
  on public.company_inventory_settings;
create trigger trg_company_inventory_settings_updated_at
before update on public.company_inventory_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_inventory_settings_guard_locked
  on public.company_inventory_settings;
create trigger trg_company_inventory_settings_guard_locked
before update on public.company_inventory_settings
for each row execute function public.company_inventory_settings_guard_locked();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.company_inventory_settings enable row level security;

drop policy if exists "company_inventory_settings_select_all"
  on public.company_inventory_settings;
create policy "company_inventory_settings_select_all"
  on public.company_inventory_settings
  for select to authenticated using (true);

drop policy if exists "company_inventory_settings_update_admin"
  on public.company_inventory_settings;
create policy "company_inventory_settings_update_admin"
  on public.company_inventory_settings
  for update to authenticated
  using (
    not foundation_locked
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  )
  with check (
    not foundation_locked
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

-- السماح بالتحديث عند القفل فقط لحقول غير مقفولة (مثل first_posted_inventory_at)
drop policy if exists "company_inventory_settings_update_locked_meta"
  on public.company_inventory_settings;
create policy "company_inventory_settings_update_locked_meta"
  on public.company_inventory_settings
  for update to authenticated
  using (
    foundation_locked
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  )
  with check (
    foundation_locked
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

drop policy if exists "company_inventory_settings_insert_admin"
  on public.company_inventory_settings;
create policy "company_inventory_settings_insert_admin"
  on public.company_inventory_settings
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );
