-- =============================================================================
-- patch_accounting_periods.sql — فترات محاسبية
-- =============================================================================
-- يتطلب: patch_branches.sql (branch_id اختياري)
-- =============================================================================

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  period_code varchar(20) not null,
  name_ar varchar(120) not null,
  fiscal_year int not null check (fiscal_year >= 1900 and fiscal_year <= 9999),
  start_date date not null,
  end_date date not null,
  status varchar(10) not null default 'open'
    check (status in ('open', 'closed')),
  branch_id uuid null references public.branches(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_dates check (end_date >= start_date)
);

create unique index if not exists idx_accounting_periods_code_branch
  on public.accounting_periods (period_code, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_accounting_periods_fiscal_year
  on public.accounting_periods(fiscal_year);

create index if not exists idx_accounting_periods_dates
  on public.accounting_periods(start_date, end_date);

comment on table public.accounting_periods is
  'فترات محاسبية — ربط التقارير والإقفال';

alter table public.accounting_periods enable row level security;

drop policy if exists "accounting_periods_all" on public.accounting_periods;
drop policy if exists "accounting_periods_select_all" on public.accounting_periods;
drop policy if exists "accounting_periods_insert_admin" on public.accounting_periods;
drop policy if exists "accounting_periods_update_admin" on public.accounting_periods;
drop policy if exists "accounting_periods_delete_admin" on public.accounting_periods;

create policy "accounting_periods_select_all" on public.accounting_periods
  for select to authenticated using (true);

create policy "accounting_periods_insert_admin" on public.accounting_periods
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "accounting_periods_update_admin" on public.accounting_periods
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "accounting_periods_delete_admin" on public.accounting_periods
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create or replace function public.accounting_periods_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_accounting_periods_updated_at on public.accounting_periods;
create trigger trg_accounting_periods_updated_at
before update on public.accounting_periods
for each row execute function public.accounting_periods_set_updated_at();
