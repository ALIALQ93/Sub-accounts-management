-- =============================================================================
-- patch_branches.sql — الفروع + حسابات التسوية + توسيع مراكز الكلفة
-- =============================================================================
-- قرار #27 — أساس الفواتير والمقاصة بين الفروع ومراكز الكلف.
-- شغّله على قاعدة موجودة بعد 01_schema (أو setup_all).
-- التالي: patch_materials_minimal.sql (يربط warehouses.branch_id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- الفروع
-- ---------------------------------------------------------------------------

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  branch_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  is_active boolean not null default true,
  is_head_office boolean not null default false,
  default_warehouse_id uuid null,
  default_cost_center_id uuid null references public.cost_centers(id) on delete set null,
  inventory_account_id uuid null references public.accounts(id) on delete set null,
  inter_branch_account_id uuid null references public.accounts(id) on delete set null,
  address text null,
  phone varchar(50) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.branches is 'فروع المنشأة — مرتبطة بالفواتير والمستودعات والقيود';
comment on column public.branches.default_warehouse_id is 'FK إلى warehouses — يُضاف في patch_materials_minimal';
comment on column public.branches.inter_branch_account_id is 'حساب تسوية وسيط افتراضي لهذا الفرع';

create unique index if not exists idx_branches_single_head_office
  on public.branches (is_head_office)
  where is_head_office = true;

create index if not exists idx_branches_active on public.branches(is_active);
create index if not exists idx_branches_default_cost_center_id
  on public.branches(default_cost_center_id);
create index if not exists idx_branches_inventory_account_id
  on public.branches(inventory_account_id);

-- ---------------------------------------------------------------------------
-- حسابات التسوية على مستوى الشركة (اختيارية — الوسيط per نمط فاتورة أيضاً)
-- ---------------------------------------------------------------------------

create table if not exists public.company_settlement_accounts (
  id int primary key default 1 check (id = 1),
  default_inter_branch_account_id uuid null references public.accounts(id) on delete set null,
  default_inter_cc_account_id uuid null references public.accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.company_settlement_accounts is
  'حسابات وسيطة افتراضية للمقاصة — تُورَّث في السندات وتُعدَّل عند الحاجة';

insert into public.company_settlement_accounts (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- توسيع مراكز الكلفة (مقاصة CC — قرار #27)
-- ---------------------------------------------------------------------------

alter table public.cost_centers
  add column if not exists netting_includes_cash_default boolean not null default false;

alter table public.cost_centers
  add column if not exists inter_cc_account_id uuid null references public.accounts(id) on delete set null;

comment on column public.cost_centers.netting_includes_cash_default is
  'افتراضي: المقاصة بين CC تشمل النقد — قابل للتجاوز بصلاحية في السند';
comment on column public.cost_centers.inter_cc_account_id is
  'حساب تسوية وسيط افتراضي لهذا المركز';

create index if not exists idx_cost_centers_inter_cc_account_id
  on public.cost_centers(inter_cc_account_id);

-- ---------------------------------------------------------------------------
-- بذرة: فرع رئيسي واحد (إن لم يوجد أي فرع)
-- ---------------------------------------------------------------------------

insert into public.branches (branch_code, name_ar, name_en, is_head_office, is_active)
select 'MAIN', 'الفرع الرئيسي', 'Head Office', true, true
where not exists (select 1 from public.branches);

-- ---------------------------------------------------------------------------
-- محفزات
-- ---------------------------------------------------------------------------

drop trigger if exists trg_branches_updated_at on public.branches;
create trigger trg_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_settlement_accounts_updated_at on public.company_settlement_accounts;
create trigger trg_company_settlement_accounts_updated_at
before update on public.company_settlement_accounts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (نفس نمط MVP — authenticated)
-- ---------------------------------------------------------------------------

alter table public.branches enable row level security;
alter table public.company_settlement_accounts enable row level security;

drop policy if exists "branches_select_all" on public.branches;
create policy "branches_select_all" on public.branches
  for select to authenticated using (true);

drop policy if exists "branches_insert_all" on public.branches;
drop policy if exists "branches_update_all" on public.branches;
drop policy if exists "branches_insert_admin" on public.branches;
drop policy if exists "branches_update_admin" on public.branches;
drop policy if exists "branches_delete_admin" on public.branches;

create policy "branches_insert_admin" on public.branches
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "branches_update_admin" on public.branches
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "branches_delete_admin" on public.branches
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

drop policy if exists "company_settlement_accounts_select_all" on public.company_settlement_accounts;
create policy "company_settlement_accounts_select_all" on public.company_settlement_accounts
  for select to authenticated using (true);

drop policy if exists "company_settlement_accounts_update_admin" on public.company_settlement_accounts;
create policy "company_settlement_accounts_update_admin" on public.company_settlement_accounts
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

drop policy if exists "company_settlement_accounts_insert_admin" on public.company_settlement_accounts;
create policy "company_settlement_accounts_insert_admin" on public.company_settlement_accounts
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );
