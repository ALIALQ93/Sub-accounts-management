-- =============================================================================
-- setup_all.sql — إعداد كامل للتشغيل (ملف واحد)
-- =============================================================================
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor.
--
-- يدمج بالترتيب:
--   00_reset + 01_schema + 02_rls
--   + ترقيعات الفواتير/الفروع/المواد/الافتتاحي/الفترات (#27 وما بعدها)
--   + 06_storage
--
-- يشمل: المحاسبة، العملات، السندات، الفواتير، الفروع، المواد،
--       open_items_view، قيد افتتاحي، فترات محاسبية، المصادقة، الصلاحيات، Storage.
--
-- ⚠️ تحذير: يحذف جميع البيانات السابقة ويعيد بناء المخطط من الصفر.
--
-- إعادة التوليد:  powershell -File database/build_setup_all.ps1
-- =============================================================================
-- =============================================================================
-- 00_reset.sql — إعادة ضبط كاملة للمخطط المحاسبي
-- =============================================================================
-- تحذير: يحذف جميع البيانات والجداول والدوال والمحفزات والعرض account_direct_balances.
-- استخدمه فقط عند إعادة التثبيت من الصفر (تطوير / بيئة اختبار).
-- =============================================================================

drop view if exists public.open_items_view cascade;
drop view if exists public.account_direct_balances cascade;

-- جداول الترقيعات (فواتير، فروع، مواد، فترات محاسبية)
drop table if exists public.invoice_reference_links cascade;
drop table if exists public.inventory_reservations cascade;
drop table if exists public.voucher_netting_lines cascade;
drop table if exists public.accounting_periods cascade;
drop table if exists public.sales_reps cascade;
drop table if exists public.invoice_material_lines cascade;
drop table if exists public.invoice_account_lines cascade;
drop table if exists public.inventory_transfer_lines cascade;
drop table if exists public.inventory_movements cascade;
drop table if exists public.inventory_transfers cascade;
drop table if exists public.invoices cascade;
drop table if exists public.invoice_pattern_allowed_materials cascade;
drop table if exists public.invoice_pattern_allowed_categories cascade;
drop table if exists public.invoice_pattern_conditions cascade;
drop table if exists public.invoice_pattern_sequences cascade;
drop table if exists public.invoice_patterns cascade;
drop table if exists public.warehouse_material_limits cascade;
drop table if exists public.material_units cascade;
drop table if exists public.materials cascade;
drop function if exists public.material_categories_apply_hierarchy_rules() cascade;
drop function if exists public.warehouses_prevent_branch_change_with_movements() cascade;
drop table if exists public.material_categories cascade;
drop table if exists public.warehouses cascade;
drop table if exists public.company_inventory_settings cascade;
drop table if exists public.company_settlement_accounts cascade;
drop table if exists public.branches cascade;

drop table if exists public.voucher_attachments cascade;
drop table if exists public.voucher_allocations cascade;
drop table if exists public.voucher_lines cascade;
drop table if exists public.voucher_line_categories cascade;
drop table if exists public.vouchers cascade;
drop table if exists public.voucher_type_defaults cascade;
drop table if exists public.voucher_number_sequences cascade;
drop table if exists public.voucher_settings cascade;
drop table if exists public.party_settings cascade;
drop table if exists public.user_permissions cascade;
drop table if exists public.company_settings cascade;
drop table if exists public.profiles cascade;
drop type if exists public.app_role cascade;
drop table if exists public.journal_entry_lines cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.customers cascade;
drop table if exists public.vendors cascade;
drop table if exists public.accounts cascade;
drop table if exists public.cost_centers cascade;
drop table if exists public.currency_rate_history cascade;
drop table if exists public.currencies cascade;

drop function if exists public.peek_voucher_no(varchar) cascade;
drop function if exists public.reserve_voucher_no(varchar) cascade;
drop function if exists public.format_voucher_no(varchar, boolean, int, int, int) cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.accounts_apply_hierarchy_rules() cascade;
drop function if exists public.accounts_on_child_insert_make_parent_non_postable() cascade;
drop function if exists public.prevent_account_delete_when_used() cascade;
drop function if exists public.journal_lines_validate_account_is_postable() cascade;
drop function if exists public.journal_entry_validate_balance_before_post() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_permission(text) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.customers_vendors_validate_accounts() cascade;
drop function if exists public.vouchers_validate_parties() cascade;
drop function if exists public.voucher_lines_validate_account_is_postable() cascade;
drop function if exists public.delete_voucher_with_journal(uuid) cascade;
drop function if exists public.reverse_posted_voucher(uuid) cascade;
drop function if exists public.replace_voucher_lines(uuid, jsonb) cascade;
drop function if exists public.replace_voucher_allocations(uuid, jsonb) cascade;
drop function if exists public.bulk_create_accounts(jsonb) cascade;
drop function if exists public.is_force_voucher_reverse() cascade;
drop function if exists public.is_force_voucher_delete() cascade;
drop function if exists public.voucher_lines_prevent_delete_when_posted() cascade;
drop function if exists public.voucher_attachments_validate() cascade;
drop function if exists public.validate_voucher_allocations_capacity(uuid, boolean) cascade;
drop function if exists public.validate_allocation_row_capacity(uuid, uuid, numeric, uuid, boolean) cascade;
drop function if exists public.voucher_allocations_validate() cascade;
drop function if exists public.vouchers_before_update_handle_posting() cascade;
drop function if exists public.vouchers_prevent_delete_when_posted() cascade;
drop function if exists public.currencies_validate_base_rate() cascade;
drop function if exists public.currencies_prevent_deactivate_base() cascade;
drop function if exists public.currencies_prevent_base_change() cascade;
drop function if exists public.has_accounting_activity() cascade;
drop function if exists public.set_base_currency(uuid) cascade;
drop function if exists public.log_currency_rate_change(uuid, numeric, numeric, varchar, date, text) cascade;
drop function if exists public.update_currency_exchange_rate(uuid, numeric, date, text) cascade;
drop function if exists public.get_currency_rate_at_date(uuid, date) cascade;
drop function if exists public.get_trial_balance(date, date, uuid, uuid, boolean, uuid) cascade;
drop function if exists public.account_has_journal_movements(uuid) cascade;
drop function if exists public.get_account_ids_with_journal_movements() cascade;
drop function if exists public.get_inventory_balance(date, uuid, uuid, uuid, uuid, boolean) cascade;
drop function if exists public.get_inventory_movement_ledger(date, date, uuid, uuid, uuid) cascade;
drop function if exists public.post_stock_adjustment(uuid, uuid, numeric, uuid, uuid, date, text, uuid) cascade;
drop function if exists public.post_stock_adjustment_batch(jsonb, uuid, uuid, date, text, uuid) cascade;
drop function if exists public.get_inventory_analysis(date, numeric, int, uuid, uuid) cascade;
drop function if exists public.get_cogs_report(date, date, uuid, uuid, uuid, varchar) cascade;
drop function if exists public.get_inventory_movements_summary(date, date, uuid, uuid, uuid) cascade;
drop function if exists public.get_purchase_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;
drop function if exists public.get_sales_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;
drop function if exists public.assert_accounting_period_open(date, uuid) cascade;
drop function if exists public.get_open_items(uuid, uuid, varchar, uuid, varchar, uuid, boolean, boolean) cascade;
drop function if exists public.post_invoice(uuid) cascade;
drop function if exists public.close_invoice_reference(uuid) cascade;
drop function if exists public.sync_invoice_reference_links() cascade;
drop function if exists public.peek_invoice_no(uuid) cascade;
drop function if exists public.reserve_invoice_no(uuid) cascade;
drop function if exists public.format_invoice_no(varchar, boolean, int, int, int) cascade;
drop function if exists public.sync_voucher_journal_opening_flag() cascade;
drop function if exists public.voucher_allocations_apply_amount_base() cascade;
drop function if exists public.journal_entry_lines_validate_party() cascade;
drop function if exists public.sync_invoice_reservations(uuid) cascade;
drop function if exists public.release_invoice_reservations(uuid, varchar) cascade;
drop function if exists public.is_invoice_posting() cascade;
drop function if exists public._invoice_add_journal_line(uuid, uuid, varchar, numeric, numeric, uuid, uuid, uuid, uuid, uuid, text) cascade;
drop function if exists public.get_company_inventory_settings() cascade;
drop function if exists public.lock_company_inventory_foundation(text) cascade;
drop function if exists public.company_inventory_settings_guard_locked() cascade;
drop function if exists public.material_quantity_to_base(numeric, uuid) cascade;
drop function if exists public.material_quantity_from_base(numeric, uuid) cascade;
drop function if exists public.material_units_validate() cascade;
drop function if exists public.materials_require_base_unit() cascade;
drop function if exists public.accounting_periods_set_updated_at() cascade;
drop function if exists public.currencies_prevent_direct_rate_change() cascade;

-- =============================================================================
-- 01_schema.sql — المخطط المحاسبي الكامل (الوضع الحالي)
-- =============================================================================
-- يشمل: العملات، دليل الحسابات، مراكز الكلفة، القيود، السندات، الترقيم،
--       الإعدادات الافتراضية، المحفزات، العرض account_direct_balances، والبيانات الأولية.
-- شغّل بعد 00_reset.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- جداول أساسية
-- ---------------------------------------------------------------------------

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  code varchar(10) not null unique,
  name_ar varchar(100) not null,
  name_en varchar(100) not null,
  symbol varchar(10) not null,
  exchange_rate numeric(18, 6) not null default 1 check (exchange_rate > 0),
  decimal_places smallint not null default 2 check (decimal_places >= 0 and decimal_places <= 6),
  is_base boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_currencies_single_base
  on public.currencies (is_base)
  where is_base = true;

create index idx_currencies_active on public.currencies(is_active);

create table public.currency_rate_history (
  id uuid primary key default gen_random_uuid(),
  currency_id uuid not null references public.currencies(id) on delete cascade,
  exchange_rate numeric(18, 6) not null check (exchange_rate > 0),
  previous_rate numeric(18, 6) null check (previous_rate is null or previous_rate > 0),
  change_source varchar(30) not null default 'manual'
    check (change_source in ('manual', 'base_change', 'initial')),
  effective_from date not null default current_date,
  note text null,
  created_at timestamptz not null default now()
);

create index idx_currency_rate_history_currency_effective
  on public.currency_rate_history(currency_id, effective_from desc, created_at desc);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  sub_code varchar(30) null,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  parent_id uuid null references public.accounts(id) on delete restrict,
  currency_id uuid null references public.currencies(id) on delete restrict,
  level int not null default 1 check (level >= 1),
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_parent_not_self check (id is null or id <> parent_id)
);

create index idx_accounts_parent_id on public.accounts(parent_id);
create index idx_accounts_code on public.accounts(code);
create index idx_accounts_currency_id on public.accounts(currency_id);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  sub_code varchar(30) null,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cost_centers_active on public.cost_centers(is_active);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no varchar(40) not null unique,
  entry_date date not null,
  description text null,
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'posted', 'cancelled')),
  source_type varchar(30) null,
  source_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  currency_id uuid null references public.currencies(id) on delete restrict,
  exchange_rate numeric(18, 6) null check (exchange_rate is null or exchange_rate > 0),
  debit_base numeric(18, 2) not null default 0 check (debit_base >= 0),
  credit_base numeric(18, 2) not null default 0 check (credit_base >= 0),
  line_description text null,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint journal_lines_single_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index idx_journal_lines_currency_id on public.journal_entry_lines(currency_id);

create index idx_journal_lines_cost_center_id on public.journal_entry_lines(cost_center_id);

create index idx_journal_lines_entry_id on public.journal_entry_lines(journal_entry_id);
create index idx_journal_lines_account_id on public.journal_entry_lines(account_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  phone varchar(50) null,
  email varchar(200) null,
  receivable_account_id uuid not null references public.accounts(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_receivable_account_id on public.customers(receivable_account_id);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  phone varchar(50) null,
  email varchar(200) null,
  payable_account_id uuid not null references public.accounts(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vendors_payable_account_id on public.vendors(payable_account_id);

-- ---------------------------------------------------------------------------
-- المصادقة والإعدادات العامة
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'accountant', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name_ar text not null,
  full_name_en text null,
  role public.app_role not null default 'accountant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_is_active on public.profiles(is_active);

create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key varchar(80) not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index idx_user_permissions_key on public.user_permissions(permission_key);

create table public.company_settings (
  id int primary key default 1 check (id = 1),
  legal_name_ar text not null default 'شركتي',
  legal_name_en text null,
  tax_number text null,
  address text null,
  phone text null,
  email text null,
  fiscal_year_start_month int not null default 1
    check (fiscal_year_start_month between 1 and 12),
  base_currency_id uuid null references public.currencies(id) on delete set null,
  logo_url text null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- إعدادات العملاء والموردين (حساب أب افتراضي)
-- ---------------------------------------------------------------------------

create table public.party_settings (
  id int primary key default 1 check (id = 1),
  customer_parent_account_id uuid null references public.accounts(id) on delete set null,
  vendor_parent_account_id uuid null references public.accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- إعدادات السندات والترقيم
-- ---------------------------------------------------------------------------

create table public.voucher_settings (
  id int primary key default 1 check (id = 1),
  auto_number_enabled boolean not null default true,
  allow_manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.voucher_number_sequences (
  voucher_type varchar(20) primary key
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  prefix varchar(10) not null,
  padding int not null default 4 check (padding between 1 and 8),
  include_year boolean not null default true,
  last_number int not null default 0 check (last_number >= 0),
  sequence_year int not null default extract(year from current_date)::int,
  updated_at timestamptz not null default now()
);

create table public.voucher_type_defaults (
  voucher_type varchar(20) primary key
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  default_account_id uuid null references public.accounts(id) on delete set null,
  default_currency_id uuid null references public.currencies(id) on delete set null,
  default_cost_center_id uuid null references public.cost_centers(id) on delete set null,
  auto_post_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.voucher_line_categories (
  id uuid primary key default gen_random_uuid(),
  voucher_type varchar(20) not null
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  code varchar(30) not null,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  requires_quantity boolean not null default false,
  quantity_label varchar(100) null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voucher_type, code)
);

create index idx_voucher_line_categories_type_active
  on public.voucher_line_categories(voucher_type, is_active);

-- ---------------------------------------------------------------------------
-- السندات
-- ---------------------------------------------------------------------------

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_no varchar(40) not null unique,
  voucher_type varchar(20) not null
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  settlement_mode varchar(20) not null default 'account'
    check (settlement_mode in ('account', 'invoice')),
  voucher_date date not null,
  description text null,
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'approved', 'posted', 'cancelled')),
  customer_id uuid null references public.customers(id) on delete restrict,
  vendor_id uuid null references public.vendors(id) on delete restrict,
  currency_id uuid null references public.currencies(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  exchange_rate numeric(18, 6) null check (exchange_rate is null or exchange_rate > 0),
  settlement_ref_type varchar(30) null,
  settlement_ref_id uuid null,
  source_type varchar(30) null,
  source_id uuid null,
  journal_entry_id uuid null unique references public.journal_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vouchers_single_party check (
    not (customer_id is not null and vendor_id is not null)
  )
);

create index idx_vouchers_status on public.vouchers(status);
create index idx_vouchers_type on public.vouchers(voucher_type);
create index idx_vouchers_date on public.vouchers(voucher_date);
create index idx_vouchers_customer_id on public.vouchers(customer_id);
create index idx_vouchers_vendor_id on public.vouchers(vendor_id);

create table public.voucher_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  side varchar(10) not null check (side in ('debit', 'credit')),
  amount numeric(18, 2) not null check (amount > 0),
  amount_base numeric(18, 2) null check (amount_base is null or amount_base >= 0),
  line_description text null,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  line_category_id uuid null references public.voucher_line_categories(id) on delete restrict,
  category_quantity numeric(18, 4) null check (category_quantity is null or category_quantity >= 0),
  cc_optional boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.voucher_lines.cc_optional is
  'عند true يُعفى السطر من إلزامية مركز الكلفة (مثلاً أسطر حساب التصفية المقابلة)';

create index idx_voucher_lines_category_id on public.voucher_lines(line_category_id);

create index idx_voucher_lines_voucher_id on public.voucher_lines(voucher_id);
create index idx_voucher_lines_account_id on public.voucher_lines(account_id);

create table public.voucher_allocations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  target_journal_line_id uuid not null references public.journal_entry_lines(id) on delete restrict,
  applied_amount numeric(18, 2) not null check (applied_amount > 0),
  note text null,
  created_at timestamptz not null default now()
);

create index idx_voucher_allocations_voucher_id on public.voucher_allocations(voucher_id);
create index idx_voucher_allocations_target_line_id on public.voucher_allocations(target_journal_line_id);

create table public.voucher_attachments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_path text not null,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_voucher_attachments_voucher_id on public.voucher_attachments(voucher_id);
create unique index idx_voucher_attachments_storage_path on public.voucher_attachments(storage_path);

-- ---------------------------------------------------------------------------
-- عرض الأرصدة المباشرة
-- ---------------------------------------------------------------------------

create or replace view public.account_direct_balances
with (security_invoker = true)
as
select
  jel.account_id,
  coalesce(sum(jel.debit_base), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit_base), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit_base - jel.credit_base), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;

-- ---------------------------------------------------------------------------
-- دوال مساعدة
-- ---------------------------------------------------------------------------

create or replace function public.to_base_amount(
  p_amount numeric,
  p_exchange_rate numeric
)
returns numeric
language sql
immutable
as $$
  select round((p_amount * coalesce(nullif(p_exchange_rate, 0), 1))::numeric, 2);
$$;

create or replace function public.voucher_lines_apply_amount_base()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(18, 6);
begin
  select coalesce(nullif(v.exchange_rate, 0), 1)
  into v_rate
  from public.vouchers v
  where v.id = new.voucher_id;

  new.amount_base := public.to_base_amount(new.amount, v_rate);
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.format_voucher_no(
  p_prefix varchar,
  p_include_year boolean,
  p_year int,
  p_sequence int,
  p_padding int
)
returns varchar
language sql
immutable
as $$
  select case
    when p_include_year then
      p_prefix || '-' || p_year::text || '-' || lpad(p_sequence::text, p_padding, '0')
    else
      p_prefix || '-' || lpad(p_sequence::text, p_padding, '0')
  end;
$$;

create or replace function public.peek_voucher_no(p_voucher_type varchar)
returns varchar
language plpgsql
stable
as $$
declare
  v_row public.voucher_number_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_next int;
begin
  select * into v_row
  from public.voucher_number_sequences
  where voucher_type = p_voucher_type;

  if not found then
    raise exception 'Unknown voucher type: %', p_voucher_type;
  end if;

  v_next := v_row.last_number + 1;
  if v_row.include_year and v_row.sequence_year <> v_year then
    v_next := 1;
  end if;

  return public.format_voucher_no(
    v_row.prefix,
    v_row.include_year,
    v_year,
    v_next,
    v_row.padding
  );
end;
$$;

create or replace function public.reserve_voucher_no(p_voucher_type varchar)
returns varchar
language plpgsql
as $$
declare
  v_row public.voucher_number_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_next int;
  v_no varchar(40);
begin
  select * into v_row
  from public.voucher_number_sequences
  where voucher_type = p_voucher_type
  for update;

  if not found then
    raise exception 'Unknown voucher type: %', p_voucher_type;
  end if;

  if v_row.include_year and v_row.sequence_year <> v_year then
    v_row.last_number := 0;
    v_row.sequence_year := v_year;
  end if;

  v_next := v_row.last_number + 1;
  v_no := public.format_voucher_no(
    v_row.prefix,
    v_row.include_year,
    v_year,
    v_next,
    v_row.padding
  );

  update public.voucher_number_sequences
  set
    last_number = v_next,
    sequence_year = v_year,
    updated_at = now()
  where voucher_type = p_voucher_type;

  return v_no;
end;
$$;

grant execute on function public.peek_voucher_no(varchar) to authenticated;
grant execute on function public.reserve_voucher_no(varchar) to authenticated;

-- ---------------------------------------------------------------------------
-- قواعد العمل: دليل الحسابات
-- ---------------------------------------------------------------------------

create or replace function public.accounts_apply_hierarchy_rules()
returns trigger
language plpgsql
as $$
declare
  v_parent_is_postable boolean;
  v_has_children boolean;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Account cannot be parent of itself.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants as (
          select id, parent_id
          from public.accounts
          where parent_id = old.id
          union all
          select a.id, a.parent_id
          from public.accounts a
          inner join descendants d on a.parent_id = d.id
        )
        select 1
        from descendants
        where id = new.parent_id
      ) then
        raise exception 'Circular hierarchy is not allowed.';
      end if;
    end if;

    select is_postable
    into v_parent_is_postable
    from public.accounts
    where id = new.parent_id;

    if v_parent_is_postable then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = new.parent_id
      ) then
        raise exception 'Parent account has journal entries and cannot have child accounts.';
      end if;
    end if;

    new.level := coalesce((select level + 1 from public.accounts where id = new.parent_id), 1);
  else
    new.level := 1;
  end if;

  if tg_op = 'UPDATE' then
    select exists (
      select 1 from public.accounts c where c.parent_id = old.id
    ) into v_has_children;

    if v_has_children and new.is_postable then
      raise exception 'Parent account cannot be postable.';
    end if;

    if old.is_postable = true and new.is_postable = false then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = old.id
      ) then
        raise exception 'Cannot change postable account to parent while it has journal entries.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.accounts_on_child_insert_make_parent_non_postable()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    update public.accounts
    set is_postable = false
    where id = new.parent_id and is_postable = true;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_account_delete_when_used()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.accounts c where c.parent_id = old.id) then
    raise exception 'Cannot delete account that has child accounts.';
  end if;

  if exists (select 1 from public.journal_entry_lines l where l.account_id = old.id) then
    raise exception 'Cannot delete account used in journal entries.';
  end if;

  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- قواعد العمل: العملات
-- ---------------------------------------------------------------------------

create or replace function public.currencies_validate_base_rate()
returns trigger
language plpgsql
as $$
begin
  if new.is_base then
    new.exchange_rate := 1;
  end if;

  if new.is_base and not new.is_active then
    raise exception 'Base currency cannot be deactivated.';
  end if;

  return new;
end;
$$;

create or replace function public.currencies_prevent_deactivate_base()
returns trigger
language plpgsql
as $$
begin
  if old.is_base and new.is_active = false then
    raise exception 'Base currency cannot be deactivated.';
  end if;
  return new;
end;
$$;

create or replace function public.has_accounting_activity()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.journal_entries je
    where je.status = 'posted'
  )
  or exists (
    select 1
    from public.vouchers v
    where v.status = 'posted'
  );
$$;

create or replace function public.currencies_prevent_base_change()
returns trigger
language plpgsql
as $$
begin
  if old.is_base is distinct from new.is_base then
    if coalesce(current_setting('app.allow_base_currency_change', true), '') <> 'on' then
      raise exception 'Base currency can only be changed via set_base_currency().';
    end if;

    if public.has_accounting_activity() then
      raise exception 'Cannot change base currency after the first posted accounting transaction.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_base_currency(p_currency_id uuid)
returns void
language plpgsql
as $$
declare
  v_new public.currencies%rowtype;
  v_pivot_rate numeric(18, 6);
begin
  if public.has_accounting_activity() then
    raise exception 'Cannot change base currency after the first posted accounting transaction.';
  end if;

  select * into v_new
  from public.currencies
  where id = p_currency_id;

  if not found then
    raise exception 'Currency not found.';
  end if;

  if v_new.is_base then
    return;
  end if;

  v_pivot_rate := v_new.exchange_rate;
  if v_pivot_rate <= 0 then
    raise exception 'Invalid exchange rate on target currency.';
  end if;

  perform set_config('app.allow_base_currency_change', 'on', true);

  insert into public.currency_rate_history (
    currency_id,
    exchange_rate,
    previous_rate,
    change_source,
    effective_from,
    note
  )
  select
    c.id,
    case
      when c.id = p_currency_id then 1
      else round((c.exchange_rate / v_pivot_rate)::numeric, 6)
    end,
    c.exchange_rate,
    'base_change',
    current_date,
    'تغيير العملة الأساسية إلى ' || v_new.code
  from public.currencies c;

  update public.currencies
  set
    is_base = (id = p_currency_id),
    exchange_rate = case
      when id = p_currency_id then 1
      else round((exchange_rate / v_pivot_rate)::numeric, 6)
    end,
    is_active = case
      when id = p_currency_id then true
      else is_active
    end,
    updated_at = now();
end;
$$;

create or replace function public.log_currency_rate_change(
  p_currency_id uuid,
  p_exchange_rate numeric,
  p_previous_rate numeric,
  p_change_source varchar,
  p_effective_from date default current_date,
  p_note text default null
)
returns void
language plpgsql
as $$
begin
  insert into public.currency_rate_history (
    currency_id,
    exchange_rate,
    previous_rate,
    change_source,
    effective_from,
    note
  )
  values (
    p_currency_id,
    p_exchange_rate,
    p_previous_rate,
    p_change_source,
    p_effective_from,
    p_note
  );
end;
$$;

create or replace function public.currencies_prevent_direct_rate_change()
returns trigger
language plpgsql
as $$
begin
  if old.exchange_rate is distinct from new.exchange_rate then
    if coalesce(current_setting('app.allow_currency_rate_change', true), '') <> 'on'
       and coalesce(current_setting('app.allow_base_currency_change', true), '') <> 'on' then
      raise exception 'Exchange rate must be changed via update_currency_exchange_rate().';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.update_currency_exchange_rate(
  p_currency_id uuid,
  p_exchange_rate numeric,
  p_effective_from date default current_date,
  p_note text default null
)
returns void
language plpgsql
as $$
declare
  v_currency public.currencies%rowtype;
  v_old_rate numeric(18, 6);
begin
  if p_exchange_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero.';
  end if;

  select * into v_currency
  from public.currencies
  where id = p_currency_id;

  if not found then
    raise exception 'Currency not found.';
  end if;

  if v_currency.is_base then
    raise exception 'Base currency exchange rate is always 1.';
  end if;

  v_old_rate := v_currency.exchange_rate;
  if v_old_rate = p_exchange_rate then
    return;
  end if;

  perform public.log_currency_rate_change(
    p_currency_id,
    p_exchange_rate,
    v_old_rate,
    'manual',
    p_effective_from,
    p_note
  );

  perform set_config('app.allow_currency_rate_change', 'on', true);

  update public.currencies
  set
    exchange_rate = p_exchange_rate,
    updated_at = now()
  where id = p_currency_id;
end;
$$;

create or replace function public.get_currency_rate_at_date(
  p_currency_id uuid,
  p_as_of date default current_date
)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select h.exchange_rate
      from public.currency_rate_history h
      where h.currency_id = p_currency_id
        and h.effective_from <= p_as_of
      order by h.effective_from desc, h.created_at desc
      limit 1
    ),
    (select c.exchange_rate from public.currencies c where c.id = p_currency_id),
    1::numeric
  );
$$;

create or replace function public.get_trial_balance(
  p_from_date date default null,
  p_to_date date default null,
  p_currency_id uuid default null,
  p_account_id uuid default null,
  p_account_subtree boolean default true,
  p_cost_center_id uuid default null
)
returns table (
  account_id uuid,
  account_code varchar,
  account_name varchar,
  currency_id uuid,
  parent_id uuid,
  is_postable boolean,
  opening_balance numeric,
  period_debit numeric,
  period_credit numeric,
  closing_balance numeric
)
language sql
stable
as $$
  with scoped_accounts as (
    select a.*
    from public.accounts a
    where a.is_active = true
      and (p_currency_id is null or a.currency_id = p_currency_id)
      and (
        p_account_id is null
        or (
          p_account_subtree
          and a.id in (
            with recursive account_tree as (
              select id
              from public.accounts
              where id = p_account_id
              union all
              select child.id
              from public.accounts child
              inner join account_tree parent on child.parent_id = parent.id
            )
            select id from account_tree
          )
        )
        or (not p_account_subtree and a.id = p_account_id)
      )
  ),
  line_agg as (
    select
      jel.account_id,
      coalesce(sum(
        case
          when p_from_date is not null and je.entry_date < p_from_date
            then jel.debit_base - jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as opening_balance,
      coalesce(sum(
        case
          when (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.debit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_debit,
      coalesce(sum(
        case
          when (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_credit
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where je.status = 'posted'
      and (p_cost_center_id is null or jel.cost_center_id = p_cost_center_id)
    group by jel.account_id
  )
  select
    sa.id as account_id,
    sa.code as account_code,
    sa.name_ar as account_name,
    sa.currency_id,
    sa.parent_id,
    sa.is_postable,
    coalesce(la.opening_balance, 0)::numeric(18, 2) as opening_balance,
    coalesce(la.period_debit, 0)::numeric(18, 2) as period_debit,
    coalesce(la.period_credit, 0)::numeric(18, 2) as period_credit,
    (
      coalesce(la.opening_balance, 0)
      + coalesce(la.period_debit, 0)
      - coalesce(la.period_credit, 0)
    )::numeric(18, 2) as closing_balance
  from scoped_accounts sa
  left join line_agg la on la.account_id = sa.id
  where sa.is_postable = true
  order by sa.code;
$$;

-- ---------------------------------------------------------------------------
-- قواعد العمل: القيود
-- ---------------------------------------------------------------------------

create or replace function public.journal_lines_validate_account_is_postable()
returns trigger
language plpgsql
as $$
declare
  v_is_postable boolean;
  v_is_active boolean;
begin
  select is_postable, is_active
  into v_is_postable, v_is_active
  from public.accounts
  where id = new.account_id;

  if not v_is_postable then
    raise exception 'Journal posting is allowed only on leaf/postable accounts.';
  end if;

  if not v_is_active then
    raise exception 'Journal posting is not allowed on inactive accounts.';
  end if;

  return new;
end;
$$;

create or replace function public.journal_entry_validate_balance_before_post()
returns trigger
language plpgsql
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
begin
  if new.status = 'posted' and old.status <> 'posted' then
    select
      coalesce(sum(debit), 0),
      coalesce(sum(credit), 0)
    into v_debit, v_credit
    from public.journal_entry_lines
    where journal_entry_id = new.id;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced journal entry: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty journal entry.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- قواعد العمل: العملاء والموردون
-- ---------------------------------------------------------------------------

create or replace function public.customers_vendors_validate_accounts()
returns trigger
language plpgsql
as $$
declare
  v_is_postable boolean;
  v_is_active boolean;
begin
  if TG_TABLE_NAME = 'customers' then
    select is_postable, is_active
    into v_is_postable, v_is_active
    from public.accounts
    where id = new.receivable_account_id;
  else
    select is_postable, is_active
    into v_is_postable, v_is_active
    from public.accounts
    where id = new.payable_account_id;
  end if;

  if not v_is_postable then
    raise exception 'Linked receivable/payable account must be postable.';
  end if;

  if not v_is_active then
    raise exception 'Linked receivable/payable account must be active.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- المصادقة والملفات الشخصية
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.user_permissions
      where user_id = auth.uid()
        and permission_key = p_key
    );
$$;

create or replace function public.sync_posted_voucher_journal(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if not public.is_admin() then
    raise exception 'Only administrators can sync posted voucher journals.';
  end if;

  select *
  into v_voucher
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_voucher.status <> 'posted' then
    raise exception 'Voucher is not posted.';
  end if;

  if v_voucher.journal_entry_id is null then
    raise exception 'Posted voucher has no linked journal entry.';
  end if;

  v_rate := coalesce(nullif(v_voucher.exchange_rate, 0), 1);

  select
    coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
    coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
  into v_debit, v_credit
  from public.voucher_lines
  where voucher_id = p_voucher_id;

  if v_debit = 0 and v_credit = 0 then
    raise exception 'Cannot sync empty voucher.';
  end if;

  if v_debit <> v_credit then
    raise exception 'Cannot sync unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
  end if;

  if v_voucher.voucher_type = 'settlement' then
    if exists (
      select 1
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is null
        and vl.amount > 0
        and not coalesce(vl.cc_optional, false)
    ) then
      raise exception 'Settlement voucher lines require a cost center.';
    end if;

    select count(*)
    into v_unbalanced_cc
    from (
      select
        vl.cost_center_id,
        coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
        coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is not null
      group by vl.cost_center_id
    ) cc
    where cc.debit_total <> cc.credit_total;

    if v_unbalanced_cc > 0 then
      raise exception 'Cannot sync settlement voucher: cost centers must balance.';
    end if;
  end if;

  delete from public.journal_entry_lines
  where journal_entry_id = v_voucher.journal_entry_id;

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    line_description,
    cost_center_id,
    currency_id,
    exchange_rate,
    debit_base,
    credit_base
  )
  select
    v_voucher.journal_entry_id,
    vl.account_id,
    case when vl.side = 'debit' then vl.amount else 0 end as debit,
    case when vl.side = 'credit' then vl.amount else 0 end as credit,
    trim(both from concat_ws(
      ' — ',
      nullif(trim(vl.line_description), ''),
      case
        when vlc.name_ar is not null then
          'نوع: ' || vlc.name_ar ||
          case
            when vl.category_quantity is not null and vl.category_quantity > 0 then
              ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
              ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
            else ''
          end
        else null
      end
    )),
    vl.cost_center_id,
    v_voucher.currency_id,
    v_rate,
    case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
    case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
  from public.voucher_lines vl
  left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
  where vl.voucher_id = p_voucher_id;

  update public.journal_entries
  set
    entry_date = v_voucher.voucher_date,
    description = coalesce(
      v_voucher.description,
      'Auto-posted from voucher ' || v_voucher.voucher_no
    ),
    updated_at = now()
  where id = v_voucher.journal_entry_id;
end;
$$;

grant execute on function public.sync_posted_voucher_journal(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_count int;
begin
  select count(*) into v_count from public.profiles;

  if v_count = 0 then
    v_role := 'admin';
  else
    v_role := 'accountant';
  end if;

  insert into public.profiles (id, email, full_name_ar, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name_ar',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    v_role
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- قواعد العمل: السندات
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_validate_parties()
returns trigger
language plpgsql
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if TG_OP = 'UPDATE' and new.status = 'posted' and old.status = 'posted' then
    if not public.is_admin()
      and not public.is_force_voucher_delete()
      and not public.is_force_voucher_reverse() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;
  end if;

  if new.customer_id is not null then
    select is_active into v_customer_active from public.customers where id = new.customer_id;
    if not coalesce(v_customer_active, false) then
      raise exception 'Referenced customer must be active.';
    end if;
  end if;

  if new.vendor_id is not null then
    select is_active into v_vendor_active from public.vendors where id = new.vendor_id;
    if not coalesce(v_vendor_active, false) then
      raise exception 'Referenced vendor must be active.';
    end if;
  end if;

  if new.settlement_mode = 'invoice' then
    if new.voucher_type not in ('receipt', 'payment') then
      raise exception 'Invoice settlement mode is allowed only for receipt/payment vouchers.';
    end if;

    if new.customer_id is null and new.vendor_id is null then
      raise exception 'Invoice settlement voucher requires a customer or vendor reference.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.voucher_lines_validate_account_is_postable()
returns trigger
language plpgsql
as $$
declare
  v_is_postable boolean;
  v_is_active boolean;
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = new.voucher_id;

  if v_voucher_status = 'posted' and not public.is_admin() then
    raise exception 'Posted voucher lines cannot be changed.';
  end if;

  select is_postable, is_active
  into v_is_postable, v_is_active
  from public.accounts
  where id = new.account_id;

  if not v_is_postable then
    raise exception 'Voucher posting is allowed only on leaf/postable accounts.';
  end if;

  if not v_is_active then
    raise exception 'Voucher posting is not allowed on inactive accounts.';
  end if;

  return new;
end;
$$;

create or replace function public.voucher_lines_prevent_delete_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = old.voucher_id;

  if v_voucher_status = 'posted' and not public.is_admin() and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher lines cannot be deleted.';
  end if;

  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- حد التخصيص — منع تجاوز المبلغ المفتوح (race-safe عند الترحيل)
-- ---------------------------------------------------------------------------

create or replace function public.validate_allocation_row_capacity(
  p_voucher_id uuid,
  p_target_journal_line_id uuid,
  p_applied_amount numeric,
  p_exclude_allocation_id uuid default null,
  p_lock_line boolean default false
)
returns void
language plpgsql
as $$
declare
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
  v_voucher_line_total numeric(18, 2);
begin
  if p_applied_amount < 0 then
    raise exception 'Applied allocation amount cannot be negative.';
  end if;

  if p_applied_amount = 0 and p_exclude_allocation_id is null then
    raise exception 'Applied allocation amount must be positive.';
  end if;

  if p_lock_line then
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted'
    for update of jel;
  else
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted';
  end if;

  if v_original is null then
    raise exception 'Target journal line is not a posted entry line.';
  end if;

  select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
  into v_posted
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where va.target_journal_line_id = p_target_journal_line_id
    and v.status = 'posted'
    and v.id <> p_voucher_id;

  select
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) + p_applied_amount
  into v_voucher_line_total
  from public.voucher_allocations va
  where va.voucher_id = p_voucher_id
    and va.target_journal_line_id = p_target_journal_line_id
    and (p_exclude_allocation_id is null or va.id <> p_exclude_allocation_id);

  if v_posted + v_voucher_line_total > v_original + 0.01 then
    raise exception
      'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
      v_posted + v_voucher_line_total,
      v_original,
      greatest(v_original - v_posted, 0);
  end if;
end;
$$;

create or replace function public.validate_voucher_allocations_capacity(
  p_voucher_id uuid,
  p_lock_lines boolean default false
)
returns void
language plpgsql
as $$
declare
  r record;
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
begin
  for r in
    select
      va.target_journal_line_id,
      sum(va.applied_amount)::numeric(18, 2) as line_total
    from public.voucher_allocations va
    where va.voucher_id = p_voucher_id
    group by va.target_journal_line_id
  loop
    if r.line_total <= 0 then
      raise exception 'Applied allocation amount must be positive.';
    end if;

    if p_lock_lines then
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted'
      for update of jel;
    else
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted';
    end if;

    if v_original is null then
      raise exception 'Target journal line is not a posted entry line.';
    end if;

    select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
    into v_posted
    from public.voucher_allocations va
    inner join public.vouchers v on v.id = va.voucher_id
    where va.target_journal_line_id = r.target_journal_line_id
      and v.status = 'posted'
      and v.id <> p_voucher_id;

    if v_posted + r.line_total > v_original + 0.01 then
      raise exception
        'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
        v_posted + r.line_total,
        v_original,
        greatest(v_original - v_posted, 0);
    end if;
  end loop;
end;
$$;

grant execute on function public.validate_allocation_row_capacity(uuid, uuid, numeric, uuid, boolean)
  to authenticated;
grant execute on function public.validate_voucher_allocations_capacity(uuid, boolean)
  to authenticated;

create or replace function public.voucher_allocations_validate()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
  v_settlement_mode varchar(20);
begin
  select status, settlement_mode
  into v_voucher_status, v_settlement_mode
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status = 'posted'
    and not public.is_admin()
    and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
  end if;

  if TG_OP = 'UPDATE'
    and old.target_journal_line_id is distinct from new.target_journal_line_id then
    perform public.validate_allocation_row_capacity(
      new.voucher_id,
      old.target_journal_line_id,
      0,
      old.id,
      false
    );
  end if;

  perform public.validate_allocation_row_capacity(
    new.voucher_id,
    new.target_journal_line_id,
    new.applied_amount,
    case when TG_OP = 'UPDATE' then old.id else null end,
    false
  );

  return new;
end;
$$;

create or replace function public.voucher_attachments_validate()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status in ('posted', 'cancelled')
    and not public.is_force_voucher_delete() then
    raise exception 'Voucher attachments cannot be changed for posted or cancelled vouchers.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() or public.is_force_voucher_reverse() then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;

      perform public.validate_voucher_allocations_capacity(new.id, true);
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and not coalesce(vl.cc_optional, false)
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

create or replace function public.is_force_voucher_reverse()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.force_voucher_reverse', true), '') = 'on';
$$;

create or replace function public.reverse_posted_voucher(p_voucher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.vouchers%rowtype;
  v_new_id uuid;
  v_new_no varchar(40);
  v_suffix text;
  v_reversal_mode varchar(20);
begin
  if not public.has_permission('vouchers.edit') then
    raise exception 'Permission denied: vouchers.edit required.';
  end if;

  select * into v_src from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_src.status = 'cancelled' then
    raise exception 'Voucher is already cancelled.';
  end if;

  if v_src.status <> 'posted' then
    raise exception 'Only posted vouchers can be reversed.';
  end if;

  if v_src.voucher_no like 'RV-%' then
    raise exception 'Cannot reverse a reversal voucher.';
  end if;

  v_reversal_mode := case
    when v_src.settlement_mode = 'invoice' then 'account'
    else v_src.settlement_mode
  end;

  v_suffix := right(
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    6
  );
  v_new_no := 'RV-' || v_src.voucher_no || '-' || v_suffix;
  if length(v_new_no) > 40 then
    v_new_no := left(v_new_no, 40);
  end if;

  perform set_config('app.force_voucher_reverse', 'on', true);

  insert into public.vouchers (
    voucher_no,
    voucher_type,
    settlement_mode,
    voucher_date,
    description,
    status,
    customer_id,
    vendor_id,
    currency_id,
    exchange_rate,
    cost_center_id,
    branch_id
  )
  values (
    v_new_no,
    v_src.voucher_type,
    v_reversal_mode,
    current_date,
    'عكس السند ' || v_src.voucher_no,
    'approved',
    v_src.customer_id,
    v_src.vendor_id,
    v_src.currency_id,
    v_src.exchange_rate,
    v_src.cost_center_id,
    v_src.branch_id
  )
  returning id into v_new_id;

  insert into public.voucher_lines (
    voucher_id,
    account_id,
    side,
    amount,
    line_description,
    cost_center_id,
    line_category_id,
    category_quantity,
    cc_optional
  )
  select
    v_new_id,
    vl.account_id,
    case when vl.side = 'debit' then 'credit' else 'debit' end,
    vl.amount,
    coalesce('عكس: ' || nullif(trim(vl.line_description), ''), 'عكس سطر'),
    vl.cost_center_id,
    vl.line_category_id,
    vl.category_quantity,
    vl.cc_optional
  from public.voucher_lines vl
  where vl.voucher_id = p_voucher_id;

  insert into public.voucher_netting_lines (
    voucher_id,
    netting_kind,
    from_cc_id,
    to_cc_id,
    from_branch_id,
    to_branch_id,
    amount,
    currency_id,
    includes_cash,
    inter_account_id,
    note
  )
  select
    v_new_id,
    vnl.netting_kind,
    vnl.to_cc_id,
    vnl.from_cc_id,
    vnl.to_branch_id,
    vnl.from_branch_id,
    vnl.amount,
    vnl.currency_id,
    vnl.includes_cash,
    vnl.inter_account_id,
    coalesce('عكس: ' || nullif(trim(vnl.note), ''), vnl.note)
  from public.voucher_netting_lines vnl
  where vnl.voucher_id = p_voucher_id
    and vnl.amount > 0;

  update public.vouchers
  set status = 'posted', updated_at = now()
  where id = v_new_id;

  update public.vouchers
  set
    status = 'cancelled',
    description = trim(both from coalesce(description, '') || ' — مُعكوس بـ ' || v_new_no),
    updated_at = now()
  where id = p_voucher_id;

  perform set_config('app.force_voucher_reverse', 'off', true);

  return v_new_id;
exception
  when others then
    perform set_config('app.force_voucher_reverse', 'off', true);
    raise;
end;
$$;

grant execute on function public.reverse_posted_voucher(uuid) to authenticated;

create or replace function public.replace_voucher_lines(
  p_voucher_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_line jsonb;
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace lines on posted voucher.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines payload must be a JSON array.';
  end if;

  delete from public.voucher_lines
  where voucher_id = p_voucher_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if coalesce(v_line->>'account_id', '') = '' then
      continue;
    end if;

    if coalesce((v_line->>'amount')::numeric(18, 2), 0) <= 0 then
      continue;
    end if;

    insert into public.voucher_lines (
      voucher_id,
      account_id,
      side,
      amount,
      line_description,
      cost_center_id,
      line_category_id,
      category_quantity,
      cc_optional
    )
    values (
      p_voucher_id,
      (v_line->>'account_id')::uuid,
      v_line->>'side',
      (v_line->>'amount')::numeric(18, 2),
      nullif(trim(v_line->>'line_description'), ''),
      nullif(v_line->>'cost_center_id', '')::uuid,
      nullif(v_line->>'line_category_id', '')::uuid,
      nullif(v_line->>'category_quantity', '')::numeric(18, 4),
      coalesce((v_line->>'cc_optional')::boolean, false)
    );
  end loop;
end;
$$;

create or replace function public.replace_voucher_allocations(
  p_voucher_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_row jsonb;
  v_target_id uuid;
  v_amount numeric(18, 2);
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace allocations on posted voucher.';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Allocations payload must be a JSON array.';
  end if;

  delete from public.voucher_allocations
  where voucher_id = p_voucher_id;

  for v_row in select value from jsonb_array_elements(p_allocations)
  loop
    v_target_id := nullif(v_row->>'target_journal_line_id', '')::uuid;
    v_amount := coalesce((v_row->>'applied_amount')::numeric(18, 2), 0);

    if v_target_id is null or v_amount <= 0 then
      continue;
    end if;

    insert into public.voucher_allocations (
      voucher_id,
      target_journal_line_id,
      applied_amount,
      note
    )
    values (
      p_voucher_id,
      v_target_id,
      v_amount,
      nullif(trim(v_row->>'note'), '')
    );
  end loop;
end;
$$;

create or replace function public.bulk_create_accounts(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_account public.accounts%rowtype;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Accounts payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one account row is required.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(trim(v_row->>'code'), '') = '' then
      raise exception 'Account code is required.';
    end if;

    if coalesce(trim(v_row->>'name_ar'), '') = '' then
      raise exception 'Account name_ar is required.';
    end if;

    if coalesce(v_row->>'parent_id', '') = '' then
      raise exception 'Account parent_id is required.';
    end if;

    insert into public.accounts (
      code,
      sub_code,
      name_ar,
      name_en,
      parent_id,
      currency_id,
      is_postable,
      is_active
    )
    values (
      trim(v_row->>'code'),
      nullif(trim(v_row->>'sub_code'), ''),
      trim(v_row->>'name_ar'),
      nullif(trim(v_row->>'name_en'), ''),
      (v_row->>'parent_id')::uuid,
      nullif(v_row->>'currency_id', '')::uuid,
      coalesce((v_row->>'is_postable')::boolean, true),
      coalesce((v_row->>'is_active')::boolean, true)
    )
    returning * into v_account;

    v_result := v_result || jsonb_build_array(to_jsonb(v_account));
  end loop;

  return v_result;
end;
$$;

grant execute on function public.replace_voucher_lines(uuid, jsonb) to authenticated;
grant execute on function public.replace_voucher_allocations(uuid, jsonb) to authenticated;
grant execute on function public.bulk_create_accounts(jsonb) to authenticated;

create or replace function public.is_force_voucher_delete()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.force_voucher_delete', true), '') = 'on';
$$;

create or replace function public.delete_voucher_with_journal(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_journal_id uuid;
  v_blocking_count int;
begin
  if not public.has_permission('vouchers.delete') then
    raise exception 'Permission denied: vouchers.delete required.';
  end if;

  select * into v_voucher from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_voucher.status = 'cancelled' then
    raise exception 'Cancelled voucher cannot be deleted.';
  end if;

  v_journal_id := v_voucher.journal_entry_id;

  if v_journal_id is not null then
    select count(*) into v_blocking_count
    from public.voucher_allocations va
    inner join public.journal_entry_lines jel on jel.id = va.target_journal_line_id
    where jel.journal_entry_id = v_journal_id
      and va.voucher_id <> p_voucher_id;

    if v_blocking_count > 0 then
      raise exception
        'Cannot delete voucher: journal lines are referenced by other voucher allocations.';
    end if;
  end if;

  perform set_config('app.force_voucher_delete', 'on', true);

  delete from public.voucher_allocations where voucher_id = p_voucher_id;

  if v_journal_id is not null then
    update public.vouchers
    set journal_entry_id = null, updated_at = now()
    where id = p_voucher_id;

    delete from public.journal_entries where id = v_journal_id;
  end if;

  delete from public.vouchers where id = p_voucher_id;

  perform set_config('app.force_voucher_delete', 'off', true);
exception
  when others then
    perform set_config('app.force_voucher_delete', 'off', true);
    raise;
end;
$$;

create or replace function public.vouchers_prevent_delete_when_posted()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher cannot be deleted.';
  end if;

  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- المحفزات
-- ---------------------------------------------------------------------------

create trigger trg_currencies_updated_at
before update on public.currencies
for each row execute function public.set_updated_at();

create trigger trg_currencies_validate_base
before insert or update on public.currencies
for each row execute function public.currencies_validate_base_rate();

create trigger trg_currencies_prevent_deactivate_base
before update on public.currencies
for each row execute function public.currencies_prevent_deactivate_base();

create trigger trg_currencies_prevent_base_change
before update on public.currencies
for each row execute function public.currencies_prevent_base_change();

create trigger trg_currencies_prevent_direct_rate_change
before update on public.currencies
for each row execute function public.currencies_prevent_direct_rate_change();

create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger trg_accounts_hierarchy_rules
before insert or update on public.accounts
for each row execute function public.accounts_apply_hierarchy_rules();

create trigger trg_accounts_child_insert_parent_non_postable
after insert on public.accounts
for each row execute function public.accounts_on_child_insert_make_parent_non_postable();

create trigger trg_accounts_prevent_delete_when_used
before delete on public.accounts
for each row execute function public.prevent_account_delete_when_used();

create trigger trg_cost_centers_updated_at
before update on public.cost_centers
for each row execute function public.set_updated_at();

create trigger trg_journal_entries_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

create trigger trg_journal_lines_validate_account
before insert or update on public.journal_entry_lines
for each row execute function public.journal_lines_validate_account_is_postable();

create trigger trg_journal_entry_validate_balance
before update on public.journal_entries
for each row execute function public.journal_entry_validate_balance_before_post();

create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger trg_customers_validate_accounts
before insert or update on public.customers
for each row execute function public.customers_vendors_validate_accounts();

create trigger trg_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

create trigger trg_vendors_validate_accounts
before insert or update on public.vendors
for each row execute function public.customers_vendors_validate_accounts();

create trigger trg_voucher_type_defaults_updated_at
before update on public.voucher_type_defaults
for each row execute function public.set_updated_at();

create trigger trg_voucher_line_categories_updated_at
before update on public.voucher_line_categories
for each row execute function public.set_updated_at();

create trigger trg_vouchers_updated_at
before update on public.vouchers
for each row execute function public.set_updated_at();

create trigger trg_vouchers_validate_parties
before insert or update on public.vouchers
for each row execute function public.vouchers_validate_parties();

create trigger trg_vouchers_before_update_handle_posting
before update on public.vouchers
for each row execute function public.vouchers_before_update_handle_posting();

create trigger trg_vouchers_prevent_delete_when_posted
before delete on public.vouchers
for each row execute function public.vouchers_prevent_delete_when_posted();

create trigger trg_voucher_lines_validate_account
before insert or update on public.voucher_lines
for each row execute function public.voucher_lines_validate_account_is_postable();

create trigger trg_voucher_lines_amount_base
before insert or update of amount, voucher_id on public.voucher_lines
for each row execute function public.voucher_lines_apply_amount_base();

create trigger trg_voucher_lines_prevent_delete_when_posted
before delete on public.voucher_lines
for each row execute function public.voucher_lines_prevent_delete_when_posted();

create trigger trg_voucher_allocations_validate_insert_update
before insert or update on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

create trigger trg_voucher_allocations_validate_delete
before delete on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

create trigger trg_voucher_attachments_validate_insert_update
before insert or update on public.voucher_attachments
for each row execute function public.voucher_attachments_validate();

create trigger trg_voucher_attachments_validate_delete
before delete on public.voucher_attachments
for each row execute function public.voucher_attachments_validate();

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- البيانات الأولية
-- ---------------------------------------------------------------------------

insert into public.currencies (code, name_ar, name_en, symbol, exchange_rate, decimal_places, is_base, is_active)
values
  ('IQD', 'دينار عراقي', 'Iraqi Dinar', 'د.ع', 1, 0, true, true),
  ('USD', 'دولار أمريكي', 'US Dollar', '$', 1310, 2, false, false),
  ('EUR', 'يورو', 'Euro', '€', 1420, 2, false, false),
  ('SYP', 'ليرة سورية', 'Syrian Pound', 'ل.س', 0.105, 0, false, false),
  ('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', 357, 2, false, false);

insert into public.currency_rate_history (
  currency_id,
  exchange_rate,
  previous_rate,
  change_source,
  effective_from,
  note
)
select
  id,
  exchange_rate,
  null,
  'initial',
  current_date,
  'سعر ابتدائي'
from public.currencies;

insert into public.accounts (code, name_ar, parent_id, currency_id, level, is_postable, is_active)
values
  ('1', 'الموجودات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('2', 'الالتزامات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('3', 'حقوق الملكية', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('4', 'المبيعات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('5', 'المشتريات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('6', 'المصاريف', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('7', 'الايرادات', null, (select id from public.currencies where code = 'IQD'), 1, false, true);

insert into public.party_settings (id)
values (1);

insert into public.company_settings (id, legal_name_ar)
values (1, 'شركتي');

insert into public.voucher_settings (id)
values (1);

insert into public.voucher_number_sequences (voucher_type, prefix, padding, include_year)
values
  ('receipt', 'RCP', 4, true),
  ('payment', 'PAY', 4, true),
  ('settlement', 'SET', 4, true);

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'receipt', c.id
from public.currencies c
where c.is_base = true;

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'payment', c.id
from public.currencies c
where c.is_base = true;

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'settlement', c.id
from public.currencies c
where c.is_base = true;

-- تصنيفات أسطر السند: لا بيانات افتراضية — تُعرَّف من إعدادات السندات في التطبيق

-- =============================================================================
-- 02_rls.sql — سياسات Row Level Security
-- =============================================================================
-- شغّل بعد 01_schema.sql
-- جداول المحاسبة: سياسات مفتوحة للمستخدمين المصادق عليهم (MVP).
-- profiles / user_permissions / company_settings: سياسات مقيدة.
-- =============================================================================

alter table public.currencies enable row level security;
alter table public.currency_rate_history enable row level security;
alter table public.accounts enable row level security;
alter table public.cost_centers enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;
alter table public.company_settings enable row level security;
alter table public.party_settings enable row level security;
alter table public.voucher_settings enable row level security;
alter table public.voucher_number_sequences enable row level security;
alter table public.voucher_type_defaults enable row level security;
alter table public.voucher_line_categories enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;
alter table public.voucher_allocations enable row level security;
alter table public.voucher_attachments enable row level security;

-- currencies
drop policy if exists "currencies_select_all" on public.currencies;
create policy "currencies_select_all" on public.currencies
  for select to authenticated using (true);
drop policy if exists "currencies_insert_all" on public.currencies;
create policy "currencies_insert_all" on public.currencies
  for insert to authenticated with check (true);
drop policy if exists "currencies_update_all" on public.currencies;
create policy "currencies_update_all" on public.currencies
  for update to authenticated using (true) with check (true);

-- currency_rate_history (قراءة فقط من الواجهة — الإدراج عبر دوال SQL)
drop policy if exists "currency_rate_history_select_all" on public.currency_rate_history;
create policy "currency_rate_history_select_all" on public.currency_rate_history
  for select to authenticated using (true);
drop policy if exists "currency_rate_history_insert_all" on public.currency_rate_history;
create policy "currency_rate_history_insert_all" on public.currency_rate_history
  for insert to authenticated with check (true);

-- accounts
drop policy if exists "accounts_select_all" on public.accounts;
create policy "accounts_select_all" on public.accounts
  for select to authenticated using (true);
drop policy if exists "accounts_insert_all" on public.accounts;
create policy "accounts_insert_all" on public.accounts
  for insert to authenticated with check (true);
drop policy if exists "accounts_update_all" on public.accounts;
create policy "accounts_update_all" on public.accounts
  for update to authenticated using (true) with check (true);

-- cost_centers
drop policy if exists "cost_centers_select_all" on public.cost_centers;
create policy "cost_centers_select_all" on public.cost_centers
  for select to authenticated using (true);
drop policy if exists "cost_centers_insert_all" on public.cost_centers;
create policy "cost_centers_insert_all" on public.cost_centers
  for insert to authenticated with check (true);
drop policy if exists "cost_centers_update_all" on public.cost_centers;
create policy "cost_centers_update_all" on public.cost_centers
  for update to authenticated using (true) with check (true);

-- journal_entries
drop policy if exists "journal_entries_select_all" on public.journal_entries;
create policy "journal_entries_select_all" on public.journal_entries
  for select to authenticated using (true);
drop policy if exists "journal_entries_insert_all" on public.journal_entries;
create policy "journal_entries_insert_all" on public.journal_entries
  for insert to authenticated with check (true);
drop policy if exists "journal_entries_update_all" on public.journal_entries;
create policy "journal_entries_update_all" on public.journal_entries
  for update to authenticated using (true) with check (true);

-- journal_entry_lines
drop policy if exists "journal_entry_lines_select_all" on public.journal_entry_lines;
create policy "journal_entry_lines_select_all" on public.journal_entry_lines
  for select to authenticated using (true);
drop policy if exists "journal_entry_lines_insert_all" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_all" on public.journal_entry_lines
  for insert to authenticated with check (true);
drop policy if exists "journal_entry_lines_update_all" on public.journal_entry_lines;
create policy "journal_entry_lines_update_all" on public.journal_entry_lines
  for update to authenticated using (true) with check (true);

-- customers
drop policy if exists "customers_select_all" on public.customers;
create policy "customers_select_all" on public.customers
  for select to authenticated using (true);
drop policy if exists "customers_insert_all" on public.customers;
create policy "customers_insert_all" on public.customers
  for insert to authenticated with check (true);
drop policy if exists "customers_update_all" on public.customers;
create policy "customers_update_all" on public.customers
  for update to authenticated using (true) with check (true);

-- vendors
drop policy if exists "vendors_select_all" on public.vendors;
create policy "vendors_select_all" on public.vendors
  for select to authenticated using (true);
drop policy if exists "vendors_insert_all" on public.vendors;
create policy "vendors_insert_all" on public.vendors
  for insert to authenticated with check (true);
drop policy if exists "vendors_update_all" on public.vendors;
create policy "vendors_update_all" on public.vendors
  for update to authenticated using (true) with check (true);

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or public.is_admin()
    or public.has_permission('settings.users.view')
    or public.has_permission('settings.permissions.manage')
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.users.manage')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.users.manage')
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

-- user_permissions
drop policy if exists "user_permissions_select" on public.user_permissions;
create policy "user_permissions_select" on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_admin_all" on public.user_permissions;
drop policy if exists "user_permissions_insert" on public.user_permissions;
create policy "user_permissions_insert" on public.user_permissions
  for insert to authenticated
  with check (public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_update" on public.user_permissions;
create policy "user_permissions_update" on public.user_permissions
  for update to authenticated
  using (public.has_permission('settings.permissions.manage'))
  with check (public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_delete" on public.user_permissions;
create policy "user_permissions_delete" on public.user_permissions
  for delete to authenticated
  using (public.has_permission('settings.permissions.manage'));

-- company_settings
drop policy if exists "company_settings_select" on public.company_settings;
create policy "company_settings_select" on public.company_settings
  for select to authenticated, anon
  using (true);

drop policy if exists "company_settings_update_admin" on public.company_settings;
create policy "company_settings_update_admin" on public.company_settings
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

drop policy if exists "company_settings_insert_admin" on public.company_settings;
create policy "company_settings_insert_admin" on public.company_settings
  for insert to authenticated
  with check (public.is_admin());

-- party_settings
drop policy if exists "party_settings_select_all" on public.party_settings;
create policy "party_settings_select_all" on public.party_settings
  for select to authenticated using (true);
drop policy if exists "party_settings_insert_all" on public.party_settings;
create policy "party_settings_insert_all" on public.party_settings
  for insert to authenticated with check (true);
drop policy if exists "party_settings_update_all" on public.party_settings;
create policy "party_settings_update_all" on public.party_settings
  for update to authenticated using (true) with check (true);

-- voucher_settings
drop policy if exists "voucher_settings_select_all" on public.voucher_settings;
create policy "voucher_settings_select_all" on public.voucher_settings
  for select to authenticated using (true);
drop policy if exists "voucher_settings_insert_all" on public.voucher_settings;
create policy "voucher_settings_insert_all" on public.voucher_settings
  for insert to authenticated with check (true);
drop policy if exists "voucher_settings_update_all" on public.voucher_settings;
create policy "voucher_settings_update_all" on public.voucher_settings
  for update to authenticated using (true) with check (true);

-- voucher_number_sequences
drop policy if exists "voucher_number_sequences_select_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_select_all" on public.voucher_number_sequences
  for select to authenticated using (true);
drop policy if exists "voucher_number_sequences_insert_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_insert_all" on public.voucher_number_sequences
  for insert to authenticated with check (true);
drop policy if exists "voucher_number_sequences_update_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_update_all" on public.voucher_number_sequences
  for update to authenticated using (true) with check (true);

-- voucher_type_defaults
drop policy if exists "voucher_type_defaults_select_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_select_all" on public.voucher_type_defaults
  for select to authenticated using (true);
drop policy if exists "voucher_type_defaults_insert_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_insert_all" on public.voucher_type_defaults
  for insert to authenticated with check (true);
drop policy if exists "voucher_type_defaults_update_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_update_all" on public.voucher_type_defaults
  for update to authenticated using (true) with check (true);

-- voucher_line_categories
drop policy if exists "voucher_line_categories_select_all" on public.voucher_line_categories;
create policy "voucher_line_categories_select_all" on public.voucher_line_categories
  for select to authenticated using (true);
drop policy if exists "voucher_line_categories_insert_all" on public.voucher_line_categories;
create policy "voucher_line_categories_insert_all" on public.voucher_line_categories
  for insert to authenticated with check (true);
drop policy if exists "voucher_line_categories_update_all" on public.voucher_line_categories;
create policy "voucher_line_categories_update_all" on public.voucher_line_categories
  for update to authenticated using (true) with check (true);

-- vouchers
drop policy if exists "vouchers_select_all" on public.vouchers;
create policy "vouchers_select_all" on public.vouchers
  for select to authenticated using (true);
drop policy if exists "vouchers_insert_all" on public.vouchers;
create policy "vouchers_insert_all" on public.vouchers
  for insert to authenticated with check (true);
drop policy if exists "vouchers_update_all" on public.vouchers;
create policy "vouchers_update_all" on public.vouchers
  for update to authenticated using (true) with check (true);

-- voucher_lines
drop policy if exists "voucher_lines_select_all" on public.voucher_lines;
create policy "voucher_lines_select_all" on public.voucher_lines
  for select to authenticated using (true);
drop policy if exists "voucher_lines_insert_all" on public.voucher_lines;
create policy "voucher_lines_insert_all" on public.voucher_lines
  for insert to authenticated with check (true);
drop policy if exists "voucher_lines_update_all" on public.voucher_lines;
create policy "voucher_lines_update_all" on public.voucher_lines
  for update to authenticated using (true) with check (true);
drop policy if exists "voucher_lines_delete_all" on public.voucher_lines;
create policy "voucher_lines_delete_all" on public.voucher_lines
  for delete to authenticated using (true);

-- voucher_allocations
drop policy if exists "voucher_allocations_select_all" on public.voucher_allocations;
create policy "voucher_allocations_select_all" on public.voucher_allocations
  for select to authenticated using (true);
drop policy if exists "voucher_allocations_insert_all" on public.voucher_allocations;
create policy "voucher_allocations_insert_all" on public.voucher_allocations
  for insert to authenticated with check (true);
drop policy if exists "voucher_allocations_update_all" on public.voucher_allocations;
create policy "voucher_allocations_update_all" on public.voucher_allocations
  for update to authenticated using (true) with check (true);
drop policy if exists "voucher_allocations_delete_all" on public.voucher_allocations;
create policy "voucher_allocations_delete_all" on public.voucher_allocations
  for delete to authenticated using (true);

-- voucher_attachments
drop policy if exists "voucher_attachments_select_all" on public.voucher_attachments;
create policy "voucher_attachments_select_all" on public.voucher_attachments
  for select to authenticated using (true);
drop policy if exists "voucher_attachments_insert_all" on public.voucher_attachments;
create policy "voucher_attachments_insert_all" on public.voucher_attachments
  for insert to authenticated with check (true);
drop policy if exists "voucher_attachments_delete_all" on public.voucher_attachments;
create policy "voucher_attachments_delete_all" on public.voucher_attachments
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- مزامنة مستخدمي Supabase Auth الموجودين (إن وُجدوا قبل التثبيت)
-- ---------------------------------------------------------------------------
do $$
declare
  v_has_profiles boolean;
begin
  select exists (select 1 from public.profiles limit 1) into v_has_profiles;

  insert into public.profiles (id, email, full_name_ar, role)
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(
      u.raw_user_meta_data->>'full_name_ar',
      split_part(coalesce(u.email, 'user'), '@', 1)
    ),
    case
      when not v_has_profiles
        and u.id = (select id from auth.users order by created_at asc limit 1)
      then 'admin'::public.app_role
      else 'accountant'::public.app_role
    end
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
end $$;

-- =============================================================================
-- BEGIN patch_branches.sql
-- =============================================================================
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

-- =============================================================================
-- BEGIN patch_materials_minimal.sql
-- =============================================================================
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
  for select to authenticated using (true);
drop policy if exists "material_categories_insert_all" on public.material_categories;
create policy "material_categories_insert_all" on public.material_categories
  for insert to authenticated with check (true);
drop policy if exists "material_categories_update_all" on public.material_categories;
create policy "material_categories_update_all" on public.material_categories
  for update to authenticated using (true) with check (true);

drop policy if exists "warehouses_select_all" on public.warehouses;
create policy "warehouses_select_all" on public.warehouses
  for select to authenticated using (true);
drop policy if exists "warehouses_insert_all" on public.warehouses;
create policy "warehouses_insert_all" on public.warehouses
  for insert to authenticated with check (true);
drop policy if exists "warehouses_update_all" on public.warehouses;
create policy "warehouses_update_all" on public.warehouses
  for update to authenticated using (true) with check (true);

drop policy if exists "materials_select_all" on public.materials;
create policy "materials_select_all" on public.materials
  for select to authenticated using (true);
drop policy if exists "materials_insert_all" on public.materials;
create policy "materials_insert_all" on public.materials
  for insert to authenticated with check (true);
drop policy if exists "materials_update_all" on public.materials;
create policy "materials_update_all" on public.materials
  for update to authenticated using (true) with check (true);

drop policy if exists "material_units_select_all" on public.material_units;
create policy "material_units_select_all" on public.material_units
  for select to authenticated using (true);
drop policy if exists "material_units_insert_all" on public.material_units;
create policy "material_units_insert_all" on public.material_units
  for insert to authenticated with check (true);
drop policy if exists "material_units_update_all" on public.material_units;
create policy "material_units_update_all" on public.material_units
  for update to authenticated using (true) with check (true);

-- =============================================================================
-- BEGIN patch_company_inventory.sql
-- =============================================================================
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

-- =============================================================================
-- BEGIN patch_journal_dimensions.sql
-- =============================================================================
-- =============================================================================
-- patch_journal_dimensions.sql — أبعاد القيد + الحركات المفتوحة
-- =============================================================================
-- يتطلب: patch_company_inventory.sql (و patch_branches.sql للـ FK)
-- التالي: patch_invoices.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- توسيع أسطر القيد — فرع، طرف، استحقاق، مصدر الفاتورة
-- ---------------------------------------------------------------------------

alter table public.journal_entry_lines
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

alter table public.journal_entry_lines
  add column if not exists due_date date null;

alter table public.journal_entry_lines
  add column if not exists payment_terms_days int null
    check (payment_terms_days is null or payment_terms_days >= 0);

alter table public.journal_entry_lines
  add column if not exists party_type varchar(20) null
    check (party_type is null or party_type in ('customer', 'vendor'));

alter table public.journal_entry_lines
  add column if not exists party_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_invoice_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_invoice_line_id uuid null;

alter table public.journal_entry_lines
  add column if not exists source_return_id uuid null;

comment on column public.journal_entry_lines.branch_id is
  'فرع السطر — أساس المقاصة بين الفروع';
comment on column public.journal_entry_lines.party_type is
  'customer | vendor — مع party_id للذمم المفتوحة';
comment on column public.journal_entry_lines.source_invoice_id is
  'FK إلى invoices — يُضاف في patch_invoices.sql';
comment on column public.journal_entry_lines.source_return_id is
  'فاتورة مرتجع مصدر — يُضاف FK لاحقاً';

create index if not exists idx_journal_lines_branch_id
  on public.journal_entry_lines(branch_id);
create index if not exists idx_journal_lines_due_date
  on public.journal_entry_lines(due_date);
create index if not exists idx_journal_lines_party
  on public.journal_entry_lines(party_type, party_id);
create index if not exists idx_journal_lines_source_invoice_id
  on public.journal_entry_lines(source_invoice_id);

-- ---------------------------------------------------------------------------
-- تحقق: party_type و party_id معاً
-- ---------------------------------------------------------------------------

create or replace function public.journal_entry_lines_validate_party()
returns trigger
language plpgsql
as $$
begin
  if (new.party_type is null) <> (new.party_id is null) then
    raise exception 'party_type and party_id must both be set or both be null.';
  end if;

  if new.party_type = 'customer' and new.party_id is not null then
    if not exists (select 1 from public.customers c where c.id = new.party_id) then
      raise exception 'party_id does not reference an existing customer.';
    end if;
  elsif new.party_type = 'vendor' and new.party_id is not null then
    if not exists (select 1 from public.vendors v where v.id = new.party_id) then
      raise exception 'party_id does not reference an existing vendor.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_entry_lines_validate_party on public.journal_entry_lines;
create trigger trg_journal_entry_lines_validate_party
before insert or update on public.journal_entry_lines
for each row execute function public.journal_entry_lines_validate_party();

-- ---------------------------------------------------------------------------
-- عرض الحركات المفتوحة (خصم تخصيصات السندات المرحّلة فقط)
-- ---------------------------------------------------------------------------

create or replace view public.open_items_view
with (security_invoker = true)
as
with line_allocations as (
  select
    va.target_journal_line_id,
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) as allocated_amount
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where v.status = 'posted'
  group by va.target_journal_line_id
)
select
  jel.id as journal_line_id,
  je.id as journal_entry_id,
  je.entry_no,
  je.entry_date,
  jel.account_id,
  acc.code as account_code,
  acc.name_ar as account_name,
  jel.branch_id,
  br.branch_code,
  br.name_ar as branch_name,
  jel.cost_center_id,
  cc.code as cost_center_code,
  cc.name_ar as cost_center_name,
  jel.currency_id,
  jel.party_type,
  jel.party_id,
  jel.source_invoice_id,
  jel.source_return_id,
  jel.due_date,
  jel.payment_terms_days,
  jel.debit,
  jel.credit,
  abs(jel.debit - jel.credit)::numeric(18, 2) as original_amount,
  coalesce(la.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  )::numeric(18, 2) as open_amount,
  case
    when jel.debit > jel.credit then 'debit'
    when jel.credit > jel.debit then 'credit'
    else null
  end as open_side,
  case
    when jel.due_date is null then true
    when jel.due_date <= current_date then true
    else false
  end as is_eligible_for_payment,
  case
    when jel.due_date is not null and jel.due_date < current_date then true
    else false
  end as is_overdue,
  jel.line_description,
  jel.created_at as line_created_at
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
inner join public.accounts acc on acc.id = jel.account_id
left join public.branches br on br.id = jel.branch_id
left join public.cost_centers cc on cc.id = jel.cost_center_id
left join line_allocations la on la.target_journal_line_id = jel.id
where je.status = 'posted'
  and (jel.debit > 0 or jel.credit > 0)
  and greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  ) > 0;

comment on view public.open_items_view is
  'حركات قيد مرحّلة ذات رصيد مفتوح — بعد خصم voucher_allocations من السندات المرحّلة';

-- ---------------------------------------------------------------------------
-- خدمة جلب الحركات المفتوحة مع فلاتر
-- ---------------------------------------------------------------------------

create or replace function public.get_open_items(
  p_branch_id uuid default null,
  p_cost_center_id uuid default null,
  p_party_type varchar default null,
  p_party_id uuid default null,
  p_open_side varchar default null,
  p_account_id uuid default null,
  p_eligible_only boolean default false,
  p_include_overdue_only boolean default false
)
returns setof public.open_items_view
language sql
stable
security invoker
set search_path = public
as $$
  select oi.*
  from public.open_items_view oi
  where (p_branch_id is null or oi.branch_id = p_branch_id)
    and (p_cost_center_id is null or oi.cost_center_id = p_cost_center_id)
    and (p_party_type is null or oi.party_type = p_party_type)
    and (p_party_id is null or oi.party_id = p_party_id)
    and (p_open_side is null or oi.open_side = p_open_side)
    and (p_account_id is null or oi.account_id = p_account_id)
    and (not p_eligible_only or oi.is_eligible_for_payment)
    and (not p_include_overdue_only or oi.is_overdue)
  order by oi.due_date nulls last, oi.entry_date, oi.entry_no, oi.journal_line_id;
$$;

comment on function public.get_open_items is
  'جلب الحركات المفتوحة — فلاتر فرع، CC، طرف، مدين/دائن، أهلية استحقاق';

-- ---------------------------------------------------------------------------
-- توسيع journal_entries — فرع اختياري على مستوى القيد (للتقارير)
-- ---------------------------------------------------------------------------

alter table public.journal_entries
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

comment on column public.journal_entries.branch_id is
  'فرع القيد — اختياري؛ التفصيل per سطر في journal_entry_lines';

create index if not exists idx_journal_entries_branch_id
  on public.journal_entries(branch_id);

-- ---------------------------------------------------------------------------
-- توسيع السندات — فرع (للمقاصة per فرع)
-- ---------------------------------------------------------------------------

alter table public.vouchers
  add column if not exists branch_id uuid null references public.branches(id) on delete restrict;

comment on column public.vouchers.branch_id is
  'فرع السند — يقيّد التخصيصات والمقاصة per فرع';

create index if not exists idx_vouchers_branch_id on public.vouchers(branch_id);

-- =============================================================================
-- BEGIN patch_invoices.sql
-- =============================================================================
-- =============================================================================
-- patch_invoices.sql — أنماط الفواتير، الفواتير، المناقلة، حركات المخزون
-- =============================================================================
-- يتطلب: patch_journal_dimensions.sql
-- التالي: patch_settlement_foundation.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- أنماط الفواتير
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_no int generated by default as identity,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  secrecy_level smallint not null default 0 check (secrecy_level between 0 and 4),
  direction varchar(10) not null
    check (direction in ('input', 'output')),
  commercial_kind varchar(30) not null,
  is_return boolean not null default false,
  is_opening_stock boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,

  default_branch_id uuid null references public.branches(id) on delete set null,
  default_cost_center_id uuid null references public.cost_centers(id) on delete set null,
  default_currency_id uuid null references public.currencies(id) on delete set null,
  default_warehouse_id uuid null references public.warehouses(id) on delete set null,
  target_warehouse_id uuid null references public.warehouses(id) on delete set null,

  default_creditor_account_id uuid null references public.accounts(id) on delete set null,
  default_debtor_account_id uuid null references public.accounts(id) on delete set null,
  default_cost_account_id uuid null references public.accounts(id) on delete set null,
  default_inventory_account_id uuid null references public.accounts(id) on delete set null,
  default_discount_account_id uuid null references public.accounts(id) on delete set null,
  default_extra_account_id uuid null references public.accounts(id) on delete set null,
  default_commission_account_id uuid null references public.accounts(id) on delete set null,
  transfer_transit_account_id uuid null references public.accounts(id) on delete set null,
  inter_branch_account_id uuid null references public.accounts(id) on delete set null,
  inter_cc_account_id uuid null references public.accounts(id) on delete set null,
  paired_input_pattern_id uuid null references public.invoice_patterns(id) on delete set null,

  generate_journal boolean not null default true,
  auto_post boolean not null default false,
  cc_on_goods boolean not null default false,
  cc_on_party boolean not null default false,
  load_party_currency boolean not null default false,
  warehouse_movement boolean not null default false,

  pricing_material_mode varchar(30) null,
  pricing_cost_mode varchar(30) null,
  pricing_consumed_mode varchar(30) null,

  reference_settings jsonb not null default '{}'::jsonb,

  default_settlement_mode varchar(10) not null default 'credit'
    check (default_settlement_mode in ('credit', 'cash')),
  payment_terms_enabled boolean not null default false,
  default_payment_terms_days int null check (default_payment_terms_days is null or default_payment_terms_days >= 0),

  rounding_enabled boolean not null default false,
  rounding_target varchar(20) null
    check (rounding_target is null or rounding_target in ('invoice_total', 'line_amount', 'both')),
  rounding_mode varchar(10) null
    check (rounding_mode is null or rounding_mode in ('nearest', 'up', 'down')),
  rounding_step numeric(18, 4) null check (rounding_step is null or rounding_step > 0),

  numbering_start int not null default 1 check (numbering_start >= 1),
  numbering_prefix varchar(20) not null default 'INV',
  numbering_padding int not null default 4 check (numbering_padding between 1 and 8),
  numbering_include_year boolean not null default true,
  numbering_reset varchar(10) not null default 'yearly'
    check (numbering_reset in ('never', 'yearly', 'monthly')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoice_patterns_active_sort
  on public.invoice_patterns(is_active, sort_order);
create index if not exists idx_invoice_patterns_commercial_kind
  on public.invoice_patterns(commercial_kind);

-- ---------------------------------------------------------------------------
-- ترقيم per نمط
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_pattern_sequences (
  pattern_id uuid primary key references public.invoice_patterns(id) on delete cascade,
  last_number int not null default 0 check (last_number >= 0),
  sequence_year int not null default extract(year from current_date)::int,
  sequence_month int not null default extract(month from current_date)::int,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- شروط النمط (§8) — 1:1
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_pattern_conditions (
  pattern_id uuid primary key references public.invoice_patterns(id) on delete cascade,
  require_party boolean not null default false,
  require_sales_rep boolean not null default false,
  require_cost_center boolean not null default false,
  require_receipt_no boolean not null default false,
  prevent_duplicate_receipt_no boolean not null default false,
  require_payment_terms boolean not null default false,
  require_warehouse boolean not null default false,
  require_color boolean not null default false,
  require_size boolean not null default false,
  require_source boolean not null default false,
  require_caliber boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_pattern_allowed_materials (
  pattern_id uuid not null references public.invoice_patterns(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (pattern_id, material_id)
);

create table if not exists public.invoice_pattern_allowed_categories (
  pattern_id uuid not null references public.invoice_patterns(id) on delete cascade,
  category_id uuid not null references public.material_categories(id) on delete cascade,
  primary key (pattern_id, category_id)
);

-- ---------------------------------------------------------------------------
-- مستندات المناقلة
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no varchar(40) not null unique,
  from_branch_id uuid not null references public.branches(id) on delete restrict,
  to_branch_id uuid not null references public.branches(id) on delete restrict,
  from_warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  to_warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  out_invoice_id uuid null,
  in_invoice_id uuid null,
  status varchar(25) not null default 'draft'
    check (status in (
      'draft', 'dispatched', 'in_transit', 'partially_received', 'received', 'cancelled'
    )),
  shipped_at timestamptz null,
  received_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_transfers_distinct_branches check (from_branch_id <> to_branch_id)
);

create index if not exists idx_inventory_transfers_status on public.inventory_transfers(status);
create index if not exists idx_inventory_transfers_from_branch on public.inventory_transfers(from_branch_id);
create index if not exists idx_inventory_transfers_to_branch on public.inventory_transfers(to_branch_id);

-- ---------------------------------------------------------------------------
-- الفواتير
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.invoice_patterns(id) on delete restrict,
  invoice_no varchar(40) not null unique,
  invoice_date date not null,

  branch_id uuid not null references public.branches(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,

  customer_id uuid null references public.customers(id) on delete restrict,
  vendor_id uuid null references public.vendors(id) on delete restrict,

  creditor_account_id uuid null references public.accounts(id) on delete restrict,
  debtor_account_id uuid null references public.accounts(id) on delete restrict,
  cost_account_id uuid null references public.accounts(id) on delete restrict,
  inventory_account_id uuid null references public.accounts(id) on delete restrict,
  discount_account_id uuid null references public.accounts(id) on delete restrict,
  extra_account_id uuid null references public.accounts(id) on delete restrict,
  commission_account_id uuid null references public.accounts(id) on delete restrict,
  transfer_transit_account_id uuid null references public.accounts(id) on delete restrict,

  reference_invoice_id uuid null references public.invoices(id) on delete restrict,
  inventory_transfer_id uuid null references public.inventory_transfers(id) on delete restrict,
  transfer_role varchar(5) null check (transfer_role is null or transfer_role in ('out', 'in')),

  settlement_mode varchar(10) not null default 'credit'
    check (settlement_mode in ('credit', 'cash')),
  payment_terms_days int null check (payment_terms_days is null or payment_terms_days >= 0),
  due_date date null,

  currency_id uuid null references public.currencies(id) on delete restrict,
  exchange_rate numeric(18, 6) null check (exchange_rate is null or exchange_rate > 0),
  receipt_no varchar(50) null,

  description text null,
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'posted', 'cancelled')),
  journal_entry_id uuid null unique references public.journal_entries(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_single_party check (
    not (customer_id is not null and vendor_id is not null)
  )
);

create index if not exists idx_invoices_pattern_id on public.invoices(pattern_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_date on public.invoices(invoice_date);
create index if not exists idx_invoices_branch_id on public.invoices(branch_id);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_vendor_id on public.invoices(vendor_id);
create index if not exists idx_invoices_inventory_transfer_id on public.invoices(inventory_transfer_id);
create unique index if not exists idx_invoices_receipt_no_unique
  on public.invoices(receipt_no)
  where receipt_no is not null and trim(receipt_no) <> '';

-- ربط المناقلة بالفواتير (بعد إنشاء invoices)
alter table public.inventory_transfers
  drop constraint if exists inventory_transfers_out_invoice_id_fkey;
alter table public.inventory_transfers
  add constraint inventory_transfers_out_invoice_id_fkey
  foreign key (out_invoice_id) references public.invoices(id) on delete set null;

alter table public.inventory_transfers
  drop constraint if exists inventory_transfers_in_invoice_id_fkey;
alter table public.inventory_transfers
  add constraint inventory_transfers_in_invoice_id_fkey
  foreign key (in_invoice_id) references public.invoices(id) on delete set null;

-- FK مصدر الفاتورة على أسطر القيد
alter table public.journal_entry_lines
  drop constraint if exists journal_entry_lines_source_invoice_id_fkey;
alter table public.journal_entry_lines
  add constraint journal_entry_lines_source_invoice_id_fkey
  foreign key (source_invoice_id) references public.invoices(id) on delete set null;

-- ---------------------------------------------------------------------------
-- أسطر المواد
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_material_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_no int not null check (line_no > 0),

  branch_id uuid not null references public.branches(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,

  material_id uuid not null references public.materials(id) on delete restrict,
  material_unit_id uuid not null references public.material_units(id) on delete restrict,
  quantity numeric(18, 6) not null check (quantity > 0),
  quantity_base numeric(18, 6) not null check (quantity_base > 0),
  unit_price numeric(18, 4) not null default 0 check (unit_price >= 0),
  line_amount numeric(18, 2) not null default 0 check (line_amount >= 0),

  qty_shipped numeric(18, 6) null check (qty_shipped is null or qty_shipped >= 0),
  qty_received numeric(18, 6) null check (qty_received is null or qty_received >= 0),

  color varchar(50) null,
  size varchar(50) null,
  source varchar(100) null,
  caliber varchar(50) null,
  line_description text null,

  created_at timestamptz not null default now(),
  unique (invoice_id, line_no)
);

create index if not exists idx_invoice_material_lines_invoice_id
  on public.invoice_material_lines(invoice_id);
create index if not exists idx_invoice_material_lines_material_id
  on public.invoice_material_lines(material_id);
create index if not exists idx_invoice_material_lines_warehouse_id
  on public.invoice_material_lines(warehouse_id);

-- ---------------------------------------------------------------------------
-- أسطر الحسابات الإضافية
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_account_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_no int not null check (line_no > 0),

  branch_id uuid not null references public.branches(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  side varchar(10) not null check (side in ('debit', 'credit')),
  amount numeric(18, 2) not null check (amount > 0),
  description text null,

  created_at timestamptz not null default now(),
  unique (invoice_id, line_no)
);

create index if not exists idx_invoice_account_lines_invoice_id
  on public.invoice_account_lines(invoice_id);
create index if not exists idx_invoice_account_lines_account_id
  on public.invoice_account_lines(account_id);

-- ---------------------------------------------------------------------------
-- أسطر مستند المناقلة
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inventory_transfers(id) on delete cascade,
  line_no int not null check (line_no > 0),
  material_id uuid not null references public.materials(id) on delete restrict,
  material_unit_id uuid not null references public.material_units(id) on delete restrict,
  qty_ordered numeric(18, 6) not null default 0 check (qty_ordered >= 0),
  qty_shipped numeric(18, 6) not null default 0 check (qty_shipped >= 0),
  qty_received numeric(18, 6) not null default 0 check (qty_received >= 0),
  unit_cost_at_ship numeric(18, 4) null check (unit_cost_at_ship is null or unit_cost_at_ship >= 0),
  out_line_id uuid null references public.invoice_material_lines(id) on delete set null,
  in_line_id uuid null references public.invoice_material_lines(id) on delete set null,
  unique (transfer_id, line_no)
);

create index if not exists idx_inventory_transfer_lines_transfer_id
  on public.inventory_transfer_lines(transfer_id);

-- ---------------------------------------------------------------------------
-- دفتر حركات المخزون (تتبع مع كل حركة)
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null default current_date,
  material_id uuid not null references public.materials(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  quantity_delta numeric(18, 6) not null,
  quantity_base_delta numeric(18, 6) not null,
  unit_cost numeric(18, 4) null check (unit_cost is null or unit_cost >= 0),
  total_cost numeric(18, 2) null,
  movement_kind varchar(30) not null
    check (movement_kind in (
      'sale', 'purchase', 'transfer_out', 'transfer_in',
      'return_sale', 'return_purchase', 'opening_stock', 'adjustment'
    )),
  source_type varchar(30) not null,
  source_id uuid not null,
  source_line_id uuid null,
  journal_line_id uuid null references public.journal_entry_lines(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_material_wh
  on public.inventory_movements(material_id, warehouse_id, movement_date);
create index if not exists idx_inventory_movements_source
  on public.inventory_movements(source_type, source_id);

-- ---------------------------------------------------------------------------
-- ترقيم الفواتير per نمط
-- ---------------------------------------------------------------------------

create or replace function public.format_invoice_no(
  p_prefix varchar,
  p_include_year boolean,
  p_year int,
  p_sequence int,
  p_padding int
)
returns varchar
language sql
immutable
as $$
  select case
    when p_include_year then
      p_prefix || '-' || p_year::text || '-' || lpad(p_sequence::text, p_padding, '0')
    else
      p_prefix || '-' || lpad(p_sequence::text, p_padding, '0')
  end;
$$;

create or replace function public.peek_invoice_no(p_pattern_id uuid)
returns varchar
language plpgsql
stable
set search_path = public
as $$
declare
  v_pattern public.invoice_patterns%rowtype;
  v_seq public.invoice_pattern_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_month int := extract(month from current_date)::int;
  v_next int;
begin
  select * into v_pattern from public.invoice_patterns where id = p_pattern_id;
  if not found then
    raise exception 'Invoice pattern not found.';
  end if;

  select * into v_seq from public.invoice_pattern_sequences where pattern_id = p_pattern_id;
  if not found then
    v_next := v_pattern.numbering_start;
  else
    v_next := v_seq.last_number + 1;
    if v_pattern.numbering_reset = 'yearly'
       and v_pattern.numbering_include_year
       and v_seq.sequence_year <> v_year then
      v_next := v_pattern.numbering_start;
    elsif v_pattern.numbering_reset = 'monthly'
       and (v_seq.sequence_year <> v_year or v_seq.sequence_month <> v_month) then
      v_next := v_pattern.numbering_start;
    end if;
  end if;

  return public.format_invoice_no(
    v_pattern.numbering_prefix,
    v_pattern.numbering_include_year,
    v_year,
    v_next,
    v_pattern.numbering_padding
  );
end;
$$;

create or replace function public.reserve_invoice_no(p_pattern_id uuid)
returns varchar
language plpgsql
set search_path = public
as $$
declare
  v_pattern public.invoice_patterns%rowtype;
  v_seq public.invoice_pattern_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_month int := extract(month from current_date)::int;
  v_next int;
  v_no varchar(40);
begin
  select * into v_pattern from public.invoice_patterns where id = p_pattern_id;
  if not found then
    raise exception 'Invoice pattern not found.';
  end if;

  insert into public.invoice_pattern_sequences (pattern_id)
  values (p_pattern_id)
  on conflict (pattern_id) do nothing;

  select * into v_seq
  from public.invoice_pattern_sequences
  where pattern_id = p_pattern_id
  for update;

  if v_pattern.numbering_reset = 'yearly'
     and v_pattern.numbering_include_year
     and v_seq.sequence_year <> v_year then
    v_seq.last_number := 0;
    v_seq.sequence_year := v_year;
  elsif v_pattern.numbering_reset = 'monthly'
     and (v_seq.sequence_year <> v_year or v_seq.sequence_month <> v_month) then
    v_seq.last_number := 0;
    v_seq.sequence_year := v_year;
    v_seq.sequence_month := v_month;
  end if;

  v_next := greatest(v_seq.last_number + 1, v_pattern.numbering_start);
  v_no := public.format_invoice_no(
    v_pattern.numbering_prefix,
    v_pattern.numbering_include_year,
    v_year,
    v_next,
    v_pattern.numbering_padding
  );

  update public.invoice_pattern_sequences
  set
    last_number = v_next,
    sequence_year = v_year,
    sequence_month = v_month,
    updated_at = now()
  where pattern_id = p_pattern_id;

  return v_no;
end;
$$;

grant execute on function public.peek_invoice_no(uuid) to authenticated;
grant execute on function public.reserve_invoice_no(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- محفزات: إنشاء شروط + تسلسل عند نمط جديد
-- ---------------------------------------------------------------------------

create or replace function public.invoice_patterns_after_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.invoice_pattern_conditions (pattern_id)
  values (new.id)
  on conflict (pattern_id) do nothing;

  insert into public.invoice_pattern_sequences (pattern_id, last_number)
  values (new.id, greatest(new.numbering_start - 1, 0))
  on conflict (pattern_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_invoice_patterns_after_insert on public.invoice_patterns;
create trigger trg_invoice_patterns_after_insert
after insert on public.invoice_patterns
for each row execute function public.invoice_patterns_after_insert();

-- ---------------------------------------------------------------------------
-- محفزات: أسطر المواد — quantity_base + مبلغ السطر
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_apply_quantities()
returns trigger
language plpgsql
as $$
declare
  v_factor numeric(18, 6);
begin
  if not exists (
    select 1 from public.material_units mu
    where mu.id = new.material_unit_id
      and mu.material_id = new.material_id
  ) then
    raise exception 'material_unit_id does not belong to material_id.';
  end if;

  new.quantity_base := public.material_quantity_to_base(new.material_unit_id, new.quantity);
  new.line_amount := round((new.quantity * new.unit_price)::numeric, 2);

  if exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id
      and w.branch_id <> new.branch_id
  ) then
    raise exception 'warehouse branch must match line branch_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_apply_quantities on public.invoice_material_lines;
create trigger trg_invoice_material_lines_apply_quantities
before insert or update on public.invoice_material_lines
for each row execute function public.invoice_material_lines_apply_quantities();

-- ---------------------------------------------------------------------------
-- محفزات: تحقق الفاتورة والطرف
-- ---------------------------------------------------------------------------

create or replace function public.invoices_validate_parties()
returns trigger
language plpgsql
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if new.customer_id is not null then
    select is_active into v_customer_active from public.customers where id = new.customer_id;
    if not coalesce(v_customer_active, false) then
      raise exception 'Referenced customer must be active.';
    end if;
  end if;

  if new.vendor_id is not null then
    select is_active into v_vendor_active from public.vendors where id = new.vendor_id;
    if not coalesce(v_vendor_active, false) then
      raise exception 'Referenced vendor must be active.';
    end if;
  end if;

  if new.transfer_role is not null and new.inventory_transfer_id is null then
    raise exception 'transfer_role requires inventory_transfer_id.';
  end if;

  if new.settlement_mode = 'credit'
     and new.payment_terms_days is not null
     and new.due_date is null then
    new.due_date := new.invoice_date + new.payment_terms_days;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_validate_parties on public.invoices;
create trigger trg_invoices_validate_parties
before insert or update on public.invoices
for each row execute function public.invoices_validate_parties();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists trg_invoice_patterns_updated_at on public.invoice_patterns;
create trigger trg_invoice_patterns_updated_at
before update on public.invoice_patterns
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoice_pattern_conditions_updated_at on public.invoice_pattern_conditions;
create trigger trg_invoice_pattern_conditions_updated_at
before update on public.invoice_pattern_conditions
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoice_pattern_sequences_updated_at on public.invoice_pattern_sequences;
create trigger trg_invoice_pattern_sequences_updated_at
before update on public.invoice_pattern_sequences
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists trg_inventory_transfers_updated_at on public.inventory_transfers;
create trigger trg_inventory_transfers_updated_at
before update on public.inventory_transfers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.invoice_patterns enable row level security;
alter table public.invoice_pattern_sequences enable row level security;
alter table public.invoice_pattern_conditions enable row level security;
alter table public.invoice_pattern_allowed_materials enable row level security;
alter table public.invoice_pattern_allowed_categories enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_material_lines enable row level security;
alter table public.invoice_account_lines enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_lines enable row level security;
alter table public.inventory_movements enable row level security;

-- أنماط الفواتير
drop policy if exists "invoice_patterns_select_all" on public.invoice_patterns;
create policy "invoice_patterns_select_all" on public.invoice_patterns
  for select to authenticated using (true);
drop policy if exists "invoice_patterns_insert_all" on public.invoice_patterns;
create policy "invoice_patterns_insert_all" on public.invoice_patterns
  for insert to authenticated with check (true);
drop policy if exists "invoice_patterns_update_all" on public.invoice_patterns;
create policy "invoice_patterns_update_all" on public.invoice_patterns
  for update to authenticated using (true) with check (true);

-- جداول مساعدة للأنماط
drop policy if exists "invoice_pattern_sequences_select_all" on public.invoice_pattern_sequences;
create policy "invoice_pattern_sequences_select_all" on public.invoice_pattern_sequences
  for select to authenticated using (true);
drop policy if exists "invoice_pattern_sequences_insert_all" on public.invoice_pattern_sequences;
create policy "invoice_pattern_sequences_insert_all" on public.invoice_pattern_sequences
  for insert to authenticated with check (true);
drop policy if exists "invoice_pattern_sequences_update_all" on public.invoice_pattern_sequences;
create policy "invoice_pattern_sequences_update_all" on public.invoice_pattern_sequences
  for update to authenticated using (true) with check (true);

drop policy if exists "invoice_pattern_conditions_select_all" on public.invoice_pattern_conditions;
create policy "invoice_pattern_conditions_select_all" on public.invoice_pattern_conditions
  for select to authenticated using (true);
drop policy if exists "invoice_pattern_conditions_insert_all" on public.invoice_pattern_conditions;
create policy "invoice_pattern_conditions_insert_all" on public.invoice_pattern_conditions
  for insert to authenticated with check (true);
drop policy if exists "invoice_pattern_conditions_update_all" on public.invoice_pattern_conditions;
create policy "invoice_pattern_conditions_update_all" on public.invoice_pattern_conditions
  for update to authenticated using (true) with check (true);

drop policy if exists "invoice_pattern_allowed_materials_all" on public.invoice_pattern_allowed_materials;
create policy "invoice_pattern_allowed_materials_all" on public.invoice_pattern_allowed_materials
  for all to authenticated using (true) with check (true);

drop policy if exists "invoice_pattern_allowed_categories_all" on public.invoice_pattern_allowed_categories;
create policy "invoice_pattern_allowed_categories_all" on public.invoice_pattern_allowed_categories
  for all to authenticated using (true) with check (true);

-- الفواتير وأسطرها
drop policy if exists "invoices_select_all" on public.invoices;
create policy "invoices_select_all" on public.invoices
  for select to authenticated using (true);
drop policy if exists "invoices_insert_all" on public.invoices;
create policy "invoices_insert_all" on public.invoices
  for insert to authenticated with check (true);
drop policy if exists "invoices_update_all" on public.invoices;
create policy "invoices_update_all" on public.invoices
  for update to authenticated using (true) with check (true);

drop policy if exists "invoice_material_lines_all" on public.invoice_material_lines;
create policy "invoice_material_lines_all" on public.invoice_material_lines
  for all to authenticated using (true) with check (true);

drop policy if exists "invoice_account_lines_all" on public.invoice_account_lines;
create policy "invoice_account_lines_all" on public.invoice_account_lines
  for all to authenticated using (true) with check (true);

-- المناقلة والمخزون
drop policy if exists "inventory_transfers_all" on public.inventory_transfers;
create policy "inventory_transfers_all" on public.inventory_transfers
  for all to authenticated using (true) with check (true);

drop policy if exists "inventory_transfer_lines_all" on public.inventory_transfer_lines;
create policy "inventory_transfer_lines_all" on public.inventory_transfer_lines
  for all to authenticated using (true) with check (true);

drop policy if exists "inventory_movements_select_all" on public.inventory_movements;
create policy "inventory_movements_select_all" on public.inventory_movements
  for select to authenticated using (true);
drop policy if exists "inventory_movements_insert_all" on public.inventory_movements;
create policy "inventory_movements_insert_all" on public.inventory_movements
  for insert to authenticated with check (true);

-- =============================================================================
-- BEGIN patch_invoice_seeds.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_seeds.sql — أنماط فواتير جاهزة (§12)
-- =============================================================================
-- يتطلب: patch_invoices.sql
-- الحسابات الافتراضية NULL — يُضبط من الواجهة أو الإعداد الأولي
-- =============================================================================

-- مبيعات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  default_payment_terms_days, warehouse_movement, cc_on_goods, cc_on_party,
  sort_order
)
select
  'مبيعات', 'Sales', 'output', 'sale',
  'SAL', 'credit', true, 90, true, true, true, 10
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'sale' and name_ar = 'مبيعات'
);

-- مشتريات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  default_payment_terms_days, warehouse_movement, sort_order
)
select
  'مشتريات', 'Purchases', 'input', 'purchase',
  'PUR', 'credit', true, 60, true, 20
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'purchase' and name_ar = 'مشتريات'
);

-- مناقلة إخراج
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order
)
select
  'مناقلة — إخراج', 'Transfer Out', 'output', 'transfer_out',
  'TRO', true, true, 30
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'transfer_out'
);

-- مناقلة إدخال
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order
)
select
  'مناقلة — إدخال', 'Transfer In', 'input', 'transfer_in',
  'TRI', true, true, 40
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'transfer_in'
);

-- ربط out → in
update public.invoice_patterns out_p
set paired_input_pattern_id = in_p.id
from public.invoice_patterns in_p
where out_p.commercial_kind = 'transfer_out'
  and in_p.commercial_kind = 'transfer_in'
  and out_p.paired_input_pattern_id is null;

-- مرتجع مبيعات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_return,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'مرتجع مبيعات', 'Sales Return', 'input', 'return_sale', true,
  'RSR', true, 50
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'return_sale'
);

-- مرتجع مشتريات
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_return,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'مرتجع مشتريات', 'Purchase Return', 'output', 'return_purchase', true,
  'RPR', true, 60
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'return_purchase'
);

-- بضاعة أول المدة
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind, is_opening_stock,
  numbering_prefix, warehouse_movement, sort_order
)
select
  'بضاعة أول المدة', 'Opening Stock', 'input', 'opening_stock', true,
  'OPS', true, 70
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'opening_stock'
);

-- نسخ نقدي (اختيارية)
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  warehouse_movement, cc_on_goods, cc_on_party, sort_order
)
select
  'مبيعات نقدي', 'Cash Sales', 'output', 'sale',
  'SAL-C', 'cash', false, true, true, true, 11
where not exists (
  select 1 from public.invoice_patterns where name_ar = 'مبيعات نقدي'
);

insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, default_settlement_mode, payment_terms_enabled,
  warehouse_movement, sort_order
)
select
  'مشتريات نقدي', 'Cash Purchases', 'input', 'purchase',
  'PUR-C', 'cash', false, true, 21
where not exists (
  select 1 from public.invoice_patterns where name_ar = 'مشتريات نقدي'
);

-- =============================================================================
-- BEGIN patch_invoice_reservation_discount.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_reservation_discount.sql — حجز، تخفيض، مندوبي مبيعات
-- =============================================================================
-- يتطلب: patch_invoices.sql
-- الترتيب: patch #9
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تبويب التخفيض + الحجز على أنماط الفواتير (§14)
-- ---------------------------------------------------------------------------

alter table public.invoice_patterns
  add column if not exists discount_enabled boolean not null default false;

alter table public.invoice_patterns
  add column if not exists max_discount_percent numeric(5, 2) null
    check (max_discount_percent is null or (max_discount_percent >= 0 and max_discount_percent <= 100));

alter table public.invoice_patterns
  add column if not exists discount_applies_to varchar(10) null
    check (discount_applies_to is null or discount_applies_to in ('line', 'invoice'));

alter table public.invoice_patterns
  add column if not exists reservation_enabled boolean not null default false;

alter table public.invoice_patterns
  add column if not exists reserve_on_save boolean not null default true;

alter table public.invoice_patterns
  add column if not exists release_on_cancel boolean not null default true;

alter table public.invoice_patterns
  add column if not exists reservation_days int null
    check (reservation_days is null or reservation_days > 0);

-- ---------------------------------------------------------------------------
-- مندوبو مبيعات (minimal — يُوسَّع لاحقاً مع قسم المندوب)
-- ---------------------------------------------------------------------------

create table if not exists public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  rep_code varchar(20) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_reps_active on public.sales_reps(is_active);

alter table public.invoices
  add column if not exists sales_rep_id uuid null references public.sales_reps(id) on delete set null;

create index if not exists idx_invoices_sales_rep_id on public.invoices(sales_rep_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sales_reps enable row level security;

drop policy if exists "sales_reps_select_all" on public.sales_reps;
create policy "sales_reps_select_all" on public.sales_reps
  for select to authenticated using (true);

drop policy if exists "sales_reps_insert_all" on public.sales_reps;
create policy "sales_reps_insert_all" on public.sales_reps
  for insert to authenticated with check (true);

drop policy if exists "sales_reps_update_all" on public.sales_reps;
create policy "sales_reps_update_all" on public.sales_reps
  for update to authenticated using (true) with check (true);

drop trigger if exists trg_sales_reps_updated_at on public.sales_reps;
create trigger trg_sales_reps_updated_at
before update on public.sales_reps
for each row execute function public.set_updated_at();

-- مندوب تجريبي (اختياري — يُحذف أو يُعدَّل من الواجهة لاحقاً)
insert into public.sales_reps (rep_code, name_ar, name_en)
select 'REP01', 'مندوب تجريبي', 'Sample Rep'
where not exists (select 1 from public.sales_reps where rep_code = 'REP01');

-- =============================================================================
-- BEGIN patch_invoice_discount_rounding.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_discount_rounding.sql — خصم الفاتورة، تدوير، حجز مخزون
-- =============================================================================
-- يتطلب: patch_invoice_reservation_discount.sql
-- الترتيب: patch #10
-- =============================================================================

-- ---------------------------------------------------------------------------
-- خصم تجاري على أسطر المواد والفاتورة
-- ---------------------------------------------------------------------------

alter table public.invoice_material_lines
  add column if not exists discount_percent numeric(5, 2) null
    check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

alter table public.invoice_material_lines
  add column if not exists discount_amount numeric(18, 2) not null default 0
    check (discount_amount >= 0);

alter table public.invoices
  add column if not exists invoice_discount_percent numeric(5, 2) null
    check (invoice_discount_percent is null or (invoice_discount_percent >= 0 and invoice_discount_percent <= 100));

alter table public.invoices
  add column if not exists invoice_discount_amount numeric(18, 2) not null default 0
    check (invoice_discount_amount >= 0);

-- ---------------------------------------------------------------------------
-- محفز أسطر المواد — مبلغ صافٍ بعد الخصم
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_apply_quantities()
returns trigger
language plpgsql
as $$
declare
  v_gross numeric(18, 4);
  v_discount numeric(18, 2);
begin
  if not exists (
    select 1 from public.material_units mu
    where mu.id = new.material_unit_id
      and mu.material_id = new.material_id
  ) then
    raise exception 'material_unit_id does not belong to material_id.';
  end if;

  new.quantity_base := public.material_quantity_to_base(new.material_unit_id, new.quantity);
  v_gross := new.quantity * new.unit_price;

  if new.discount_percent is not null and new.discount_percent > 0 then
    v_discount := round((v_gross * new.discount_percent / 100)::numeric, 2);
    new.discount_amount := v_discount;
  else
    v_discount := coalesce(new.discount_amount, 0);
    if v_discount > v_gross then
      raise exception 'discount_amount cannot exceed line gross amount.';
    end if;
  end if;

  new.line_amount := round((v_gross - v_discount)::numeric, 2);

  if exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id
      and w.branch_id <> new.branch_id
  ) then
    raise exception 'warehouse branch must match line branch_id.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- حجز المخزون لمسودات الفواتير
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  invoice_line_id uuid not null references public.invoice_material_lines(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity numeric(18, 6) not null check (quantity > 0),
  quantity_base numeric(18, 6) not null check (quantity_base > 0),
  status varchar(20) not null default 'active'
    check (status in ('active', 'released', 'fulfilled')),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_line_id)
);

create index if not exists idx_inventory_reservations_invoice
  on public.inventory_reservations(invoice_id, status);
create index if not exists idx_inventory_reservations_material_wh
  on public.inventory_reservations(material_id, warehouse_id, status);

alter table public.inventory_reservations enable row level security;

drop policy if exists "inventory_reservations_all" on public.inventory_reservations;
create policy "inventory_reservations_all" on public.inventory_reservations
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_inventory_reservations_updated_at on public.inventory_reservations;
create trigger trg_inventory_reservations_updated_at
before update on public.inventory_reservations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- مزامنة حجوزات الفاتورة بعد الحفظ
-- ---------------------------------------------------------------------------

create or replace function public.sync_invoice_reservations(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_expires timestamptz;
  v_row record;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'invoice not found.';
  end if;

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;

  if v_inv.status <> 'draft'
     or not v_pat.reservation_enabled
     or not v_pat.reserve_on_save
     or not v_pat.warehouse_movement then
    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where invoice_id = p_invoice_id and status = 'active';
    return;
  end if;

  v_expires := case
    when v_pat.reservation_days is not null and v_pat.reservation_days > 0
    then now() + (v_pat.reservation_days || ' days')::interval
    else null
  end;

  update public.inventory_reservations
  set status = 'released', updated_at = now()
  where invoice_id = p_invoice_id
    and status = 'active'
    and invoice_line_id not in (
      select id from public.invoice_material_lines where invoice_id = p_invoice_id
    );

  for v_row in
    select iml.*
    from public.invoice_material_lines iml
    where iml.invoice_id = p_invoice_id
  loop
    insert into public.inventory_reservations (
      invoice_id, invoice_line_id, material_id, warehouse_id,
      quantity, quantity_base, status, expires_at
    )
    values (
      p_invoice_id, v_row.id, v_row.material_id, v_row.warehouse_id,
      v_row.quantity, v_row.quantity_base, 'active', v_expires
    )
    on conflict (invoice_line_id) do update set
      material_id = excluded.material_id,
      warehouse_id = excluded.warehouse_id,
      quantity = excluded.quantity,
      quantity_base = excluded.quantity_base,
      status = 'active',
      expires_at = excluded.expires_at,
      updated_at = now();
  end loop;
end;
$$;

grant execute on function public.sync_invoice_reservations(uuid) to authenticated;

-- تحرير الحجز عند الترحيل
create or replace function public.release_invoice_reservations(p_invoice_id uuid, p_status varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_reservations
  set status = p_status, updated_at = now()
  where invoice_id = p_invoice_id and status = 'active';
end;
$$;

grant execute on function public.release_invoice_reservations(uuid, varchar) to authenticated;

-- =============================================================================
-- BEGIN patch_settlement_foundation.sql
-- =============================================================================
-- =============================================================================
-- patch_settlement_foundation.sql — أساس مقاصة CC والفروع
-- =============================================================================
-- يتطلب: patch_invoice_seeds.sql
-- التالي: patch_post_invoice.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- توسيع voucher_allocations
-- ---------------------------------------------------------------------------

alter table public.voucher_allocations
  add column if not exists allocation_type varchar(20) not null default 'close'
    check (allocation_type in ('close', 'netting_cc', 'netting_branch'));

alter table public.voucher_allocations
  add column if not exists applied_amount_base numeric(18, 2) null
    check (applied_amount_base is null or applied_amount_base >= 0);

alter table public.voucher_allocations
  add column if not exists source_branch_id uuid null references public.branches(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists target_branch_id uuid null references public.branches(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists source_cost_center_id uuid null references public.cost_centers(id) on delete restrict;

alter table public.voucher_allocations
  add column if not exists target_cost_center_id uuid null references public.cost_centers(id) on delete restrict;

comment on column public.voucher_allocations.allocation_type is
  'close = إغلاق ذمة | netting_cc | netting_branch';

create index if not exists idx_voucher_allocations_allocation_type
  on public.voucher_allocations(allocation_type);
create index if not exists idx_voucher_allocations_target_branch_id
  on public.voucher_allocations(target_branch_id);

-- تعبئة applied_amount_base من السند عند الإدراج (إن وُجد سعر صرف)
create or replace function public.voucher_allocations_apply_amount_base()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(18, 6);
begin
  select coalesce(nullif(v.exchange_rate, 0), 1)
  into v_rate
  from public.vouchers v
  where v.id = new.voucher_id;

  new.applied_amount_base := public.to_base_amount(new.applied_amount, v_rate);
  return new;
end;
$$;

drop trigger if exists trg_voucher_allocations_apply_amount_base on public.voucher_allocations;
create trigger trg_voucher_allocations_apply_amount_base
before insert or update on public.voucher_allocations
for each row execute function public.voucher_allocations_apply_amount_base();

-- ---------------------------------------------------------------------------
-- أسطر المقاصة على السند (CC / فرع)
-- ---------------------------------------------------------------------------

create table if not exists public.voucher_netting_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  netting_kind varchar(10) not null check (netting_kind in ('cc', 'branch')),
  from_cc_id uuid null references public.cost_centers(id) on delete restrict,
  to_cc_id uuid null references public.cost_centers(id) on delete restrict,
  from_branch_id uuid null references public.branches(id) on delete restrict,
  to_branch_id uuid null references public.branches(id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  currency_id uuid null references public.currencies(id) on delete restrict,
  includes_cash boolean not null default false,
  inter_account_id uuid null references public.accounts(id) on delete restrict,
  note text null,
  created_at timestamptz not null default now(),
  constraint voucher_netting_lines_cc_required check (
    netting_kind <> 'cc'
    or (from_cc_id is not null and to_cc_id is not null and from_cc_id <> to_cc_id)
  ),
  constraint voucher_netting_lines_branch_required check (
    netting_kind <> 'branch'
    or (from_branch_id is not null and to_branch_id is not null and from_branch_id <> to_branch_id)
  )
);

create index if not exists idx_voucher_netting_lines_voucher_id
  on public.voucher_netting_lines(voucher_id);

alter table public.voucher_netting_lines enable row level security;

drop policy if exists "voucher_netting_lines_all" on public.voucher_netting_lines;
create policy "voucher_netting_lines_all" on public.voucher_netting_lines
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- إعادة بناء open_items_view (تخصيصات موسّعة — نفس المنطق)
-- ---------------------------------------------------------------------------

create or replace view public.open_items_view
with (security_invoker = true)
as
with line_allocations as (
  select
    va.target_journal_line_id,
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) as allocated_amount
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where v.status = 'posted'
  group by va.target_journal_line_id
)
select
  jel.id as journal_line_id,
  je.id as journal_entry_id,
  je.entry_no,
  je.entry_date,
  jel.account_id,
  acc.code as account_code,
  acc.name_ar as account_name,
  jel.branch_id,
  br.branch_code,
  br.name_ar as branch_name,
  jel.cost_center_id,
  cc.code as cost_center_code,
  cc.name_ar as cost_center_name,
  jel.currency_id,
  jel.party_type,
  jel.party_id,
  jel.source_invoice_id,
  jel.source_return_id,
  jel.due_date,
  jel.payment_terms_days,
  jel.debit,
  jel.credit,
  abs(jel.debit - jel.credit)::numeric(18, 2) as original_amount,
  coalesce(la.allocated_amount, 0)::numeric(18, 2) as allocated_amount,
  greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  )::numeric(18, 2) as open_amount,
  case
    when jel.debit > jel.credit then 'debit'
    when jel.credit > jel.debit then 'credit'
    else null
  end as open_side,
  case
    when jel.due_date is null then true
    when jel.due_date <= current_date then true
    else false
  end as is_eligible_for_payment,
  case
    when jel.due_date is not null and jel.due_date < current_date then true
    else false
  end as is_overdue,
  jel.line_description,
  jel.created_at as line_created_at
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
inner join public.accounts acc on acc.id = jel.account_id
left join public.branches br on br.id = jel.branch_id
left join public.cost_centers cc on cc.id = jel.cost_center_id
left join line_allocations la on la.target_journal_line_id = jel.id
where je.status = 'posted'
  and (jel.debit > 0 or jel.credit > 0)
  and greatest(
    abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0),
    0
  ) > 0;

-- =============================================================================
-- BEGIN patch_post_invoice.sql
-- =============================================================================
-- =============================================================================
-- patch_post_invoice.sql — ترحيل الفاتورة إلى قيد + حركة مخزون
-- =============================================================================
-- يتطلب: patch_settlement_foundation.sql
-- =============================================================================

create or replace function public.is_invoice_posting()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.invoice_posting', true), '') = 'true';
$$;

-- ---------------------------------------------------------------------------
-- إدراج سطر قيد مساعد
-- ---------------------------------------------------------------------------

create or replace function public._invoice_add_journal_line(
  p_journal_entry_id uuid,
  p_account_id uuid,
  p_debit numeric,
  p_credit numeric,
  p_description text,
  p_cost_center_id uuid,
  p_branch_id uuid,
  p_currency_id uuid,
  p_exchange_rate numeric,
  p_party_type varchar default null,
  p_party_id uuid default null,
  p_due_date date default null,
  p_payment_terms_days int default null,
  p_source_invoice_id uuid default null,
  p_source_invoice_line_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_line_id uuid;
  v_rate numeric(18, 6);
begin
  if p_account_id is null then
    raise exception 'Journal line requires account_id.';
  end if;

  if (p_debit > 0 and p_credit > 0) or (p_debit = 0 and p_credit = 0) then
    raise exception 'Journal line must have either debit or credit.';
  end if;

  v_rate := coalesce(nullif(p_exchange_rate, 0), 1);

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    line_description,
    cost_center_id,
    branch_id,
    currency_id,
    exchange_rate,
    debit_base,
    credit_base,
    party_type,
    party_id,
    due_date,
    payment_terms_days,
    source_invoice_id,
    source_invoice_line_id
  )
  values (
    p_journal_entry_id,
    p_account_id,
    coalesce(p_debit, 0),
    coalesce(p_credit, 0),
    p_description,
    p_cost_center_id,
    p_branch_id,
    p_currency_id,
    v_rate,
    public.to_base_amount(coalesce(p_debit, 0), v_rate),
    public.to_base_amount(coalesce(p_credit, 0), v_rate),
    p_party_type,
    p_party_id,
    p_due_date,
    p_payment_terms_days,
    p_source_invoice_id,
    p_source_invoice_line_id
  )
  returning id into v_line_id;

  return v_line_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- ترحيل الفاتورة
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_inv_settings public.company_inventory_settings%rowtype;
  v_je_id uuid;
  v_entry_no varchar(40);
  v_rate numeric(18, 6);
  v_creditor uuid;
  v_debtor uuid;
  v_cost uuid;
  v_inventory uuid;
  v_transit uuid;
  v_material_total numeric(18, 2) := 0;
  v_account_debit numeric(18, 2) := 0;
  v_account_credit numeric(18, 2) := 0;
  v_je_debit numeric(18, 2);
  v_je_credit numeric(18, 2);
  v_party_type varchar(20);
  v_party_id uuid;
  v_row record;
  v_line_cost numeric(18, 2);
  v_has_materials boolean;
  v_discount_acct uuid;
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_round_step numeric(18, 4);
  v_party_total numeric(18, 2);
  v_rounded_total numeric(18, 2);
  v_rounding_diff numeric(18, 2);
begin
  perform set_config('app.invoice_posting', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status = 'posted' then
    raise exception 'Invoice is already posted.';
  end if;

  if v_inv.status = 'cancelled' then
    raise exception 'Cannot post cancelled invoice.';
  end if;

  perform public.assert_accounting_period_open(v_inv.invoice_date, v_inv.branch_id);

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;
  select * into v_inv_settings from public.company_inventory_settings where id = 1;

  v_creditor := coalesce(v_inv.creditor_account_id, v_pat.default_creditor_account_id);
  v_debtor := coalesce(v_inv.debtor_account_id, v_pat.default_debtor_account_id);
  v_cost := coalesce(v_inv.cost_account_id, v_pat.default_cost_account_id);
  v_inventory := coalesce(v_inv.inventory_account_id, v_pat.default_inventory_account_id);
  v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id);
  v_rate := coalesce(nullif(v_inv.exchange_rate, 0), 1);

  select coalesce(sum(iml.line_amount), 0)
  into v_material_total
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id;

  select
    coalesce(sum(case when ial.side = 'debit' then ial.amount else 0 end), 0),
    coalesce(sum(case when ial.side = 'credit' then ial.amount else 0 end), 0)
  into v_account_debit, v_account_credit
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id;

  v_has_materials := exists (
    select 1 from public.invoice_material_lines iml where iml.invoice_id = p_invoice_id
  );

  if v_has_materials and v_inv_settings.inventory_method is null then
    raise exception 'Configure inventory_method in company_inventory_settings before posting.';
  end if;

  if not v_has_materials and v_account_debit = 0 and v_account_credit = 0 then
    raise exception 'Cannot post empty invoice.';
  end if;

  if v_inv.customer_id is not null then
    v_party_type := 'customer';
    v_party_id := v_inv.customer_id;
  elsif v_inv.vendor_id is not null then
    v_party_type := 'vendor';
    v_party_id := v_inv.vendor_id;
  else
    v_party_type := null;
    v_party_id := null;
  end if;

  v_entry_no := 'JE-' || v_inv.invoice_no;

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    v_inv.invoice_date,
    coalesce(v_inv.description, 'مرحّل من فاتورة ' || v_inv.invoice_no),
    'posted',
    'invoice',
    p_invoice_id,
    v_inv.branch_id
  )
  returning id into v_je_id;

  -- أسطر الحسابات الإضافية
  for v_row in
    select * from public.invoice_account_lines ial
    where ial.invoice_id = p_invoice_id
    order by ial.line_no
  loop
    perform public._invoice_add_journal_line(
      v_je_id,
      v_row.account_id,
      case when v_row.side = 'debit' then v_row.amount else 0 end,
      case when v_row.side = 'credit' then v_row.amount else 0 end,
      coalesce(v_row.description, 'حساب إضافي — فاتورة ' || v_inv.invoice_no),
      v_row.cost_center_id,
      v_row.branch_id,
      v_inv.currency_id,
      v_rate,
      null, null, null, null,
      p_invoice_id,
      v_row.id
    );
  end loop;

  v_discount_acct := coalesce(v_inv.discount_account_id, v_pat.default_discount_account_id);

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);

      if v_line_disc > 0 then
        if v_discount_acct is null then
          raise exception 'Line discount requires discount_account_id on invoice or pattern.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, v_line_disc, 0,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );

        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
        if v_line_cost > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_cost, v_line_cost, 0,
            'تكلفة مبيعات', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
          perform public._invoice_add_journal_line(
            v_je_id, v_inventory, 0, v_line_cost,
            'مخزون', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
        end if;
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'purchase' then
    if v_creditor is null then
      raise exception 'Purchase invoice requires creditor account (payable/cash).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, case when v_line_disc > 0 then v_line_gross else v_row.line_amount end, 0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, case when v_line_disc > 0 then v_line_gross else v_row.line_amount end, 0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_disc > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, 0, v_row.line_amount,
        case when v_inv.settlement_mode = 'credit' then 'ذمم مورد' else 'نقدي' end,
        coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
        p_invoice_id, v_row.id
      );

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'transfer_out' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Transfer out (perpetual) requires inventory account.';
        end if;
        if v_transit is null then
          raise exception 'Transfer out (perpetual) requires transit account on pattern/invoice.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, v_line_cost, 0,
          'بضاعة بالطريق — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون مصدر — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_out', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set status = 'dispatched', shipped_at = coalesce(shipped_at, now()), out_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'transfer_in' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null or v_transit is null then
          raise exception 'Transfer in (perpetual) requires inventory and transit accounts.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون هدف — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, 0, v_line_cost,
          'إغلاق بالطريق — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        coalesce(v_row.qty_received, v_row.quantity),
        v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_in', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set
        status = case
          when exists (
            select 1 from public.inventory_transfer_lines itl
            where itl.transfer_id = v_inv.inventory_transfer_id
              and itl.qty_received < itl.qty_shipped
              and itl.qty_shipped > 0
          ) then 'partially_received'
          else 'received'
        end,
        received_at = coalesce(received_at, now()),
        in_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'return_sale' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_row.line_amount, 0,
        'مرتجع مبيعات', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_row.line_amount,
        'ذمم عميل — مرتجع', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
        p_invoice_id, v_row.id
      );

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_cost, 0, v_line_cost,
          'تكلفة — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'return_sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'return_purchase' then
    if v_creditor is null then
      raise exception 'Return purchase requires creditor account (payable).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Return purchase (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_row.line_amount,
          'مخزون — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Return purchase (periodic) requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, 0, v_row.line_amount,
          'مشتريات — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'return_purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'opening_stock' then
    if v_creditor is null then
      raise exception 'Opening stock requires creditor account (opening equity / counterpart).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_row.line_amount, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'opening_stock', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  else
    raise exception 'Unsupported commercial_kind: %', v_pat.commercial_kind;
  end case;

  -- خصم الفاتورة + تدوير الإجمالي (§9 / §التخفيض)
  if coalesce(v_inv.invoice_discount_percent, 0) > 0 then
    v_invoice_disc := round((v_material_total * v_inv.invoice_discount_percent / 100)::numeric, 2);
  elsif coalesce(v_inv.invoice_discount_amount, 0) > 0 then
    v_invoice_disc := v_inv.invoice_discount_amount;
  end if;

  if v_invoice_disc > 0 then
    if v_discount_acct is null then
      raise exception 'Invoice discount requires discount_account_id on invoice or pattern.';
    end if;
    case v_pat.commercial_kind
    when 'sale' then
      if v_debtor is null then
        raise exception 'Sale discount requires debtor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, v_invoice_disc, 0,
        'خصم فاتورة — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_invoice_disc,
        'تخفيض ذمم — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
    when 'purchase' then
      if v_creditor is null then
        raise exception 'Purchase discount requires creditor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_invoice_disc, 0,
        'خصم مشتريات — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, 0, v_invoice_disc,
        'خصم مكتسب — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
    else
      null;
    end case;
  end if;

  if v_pat.rounding_enabled
     and coalesce(v_pat.rounding_target, 'invoice_total') in ('invoice_total', 'both')
     and v_pat.commercial_kind in ('sale', 'purchase') then
    v_round_step := coalesce(nullif(v_pat.rounding_step, 0), 1);
    v_party_total := v_material_total - v_invoice_disc;
    v_rounded_total := case coalesce(v_pat.rounding_mode, 'nearest')
      when 'up' then ceil(v_party_total / v_round_step - 0.0000001) * v_round_step
      when 'down' then floor(v_party_total / v_round_step + 0.0000001) * v_round_step
      else round(v_party_total / v_round_step) * v_round_step
    end;
    v_rounding_diff := round((v_rounded_total - v_party_total)::numeric, 2);

    if v_rounding_diff <> 0 then
      case v_pat.commercial_kind
      when 'sale' then
        if v_debtor is null then
          raise exception 'Sale rounding requires debtor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, v_rounding_diff, 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, 0, abs(v_rounding_diff),
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      when 'purchase' then
        if v_creditor is null then
          raise exception 'Purchase rounding requires creditor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, 0, v_rounding_diff,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, abs(v_rounding_diff), 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      else
        null;
      end case;
    end if;
  end if;

  -- توازن القيد
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_je_debit, v_je_credit
  from public.journal_entry_lines
  where journal_entry_id = v_je_id;

  if v_je_debit <> v_je_credit then
    raise exception 'Posted invoice journal is unbalanced: debit (%) <> credit (%).', v_je_debit, v_je_credit;
  end if;

  if v_has_materials then
    perform public.lock_company_inventory_foundation(v_inv.invoice_date::timestamptz);
  end if;

  update public.invoices
  set status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  where id = p_invoice_id;

  perform set_config('app.invoice_posting', 'false', true);

  return v_je_id;
exception
  when others then
    perform set_config('app.invoice_posting', 'false', true);
    raise;
end;
$$;

grant execute on function public.post_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- حماية الفاتورة المرحّلة
-- ---------------------------------------------------------------------------

create or replace function public.invoices_before_update_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    if not public.is_admin() then
      raise exception 'Posted invoice cannot be modified.';
    end if;
    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if not public.is_invoice_posting() then
      raise exception 'Use post_invoice(invoice_id) to post invoices.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_before_update_guard on public.invoices;
create trigger trg_invoices_before_update_guard
before update on public.invoices
for each row execute function public.invoices_before_update_guard();

create or replace function public.invoice_lines_prevent_change_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_status varchar(20);
begin
  select i.status into v_status
  from public.invoices i
  where i.id = coalesce(new.invoice_id, old.invoice_id);

  if v_status = 'posted' and not public.is_admin() then
    raise exception 'Cannot modify lines of a posted invoice.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_posted_guard on public.invoice_material_lines;
create trigger trg_invoice_material_lines_posted_guard
before insert or update or delete on public.invoice_material_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();

drop trigger if exists trg_invoice_account_lines_posted_guard on public.invoice_account_lines;
create trigger trg_invoice_account_lines_posted_guard
before insert or update or delete on public.invoice_account_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();

-- =============================================================================
-- BEGIN patch_invoice_multiple_references.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_multiple_references.sql — مراجع متعددة للفاتورة
-- =============================================================================
-- يتطلب: patch_invoices.sql (#5)
-- الترتيب: patch #11
-- =============================================================================

create table if not exists public.invoice_reference_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reference_invoice_id uuid not null references public.invoices(id) on delete restrict,
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),

  constraint invoice_reference_links_unique
    unique (invoice_id, reference_invoice_id),
  constraint invoice_reference_links_not_self
    check (invoice_id <> reference_invoice_id)
);

create index if not exists idx_invoice_reference_links_invoice_id
  on public.invoice_reference_links(invoice_id);

create index if not exists idx_invoice_reference_links_reference_invoice_id
  on public.invoice_reference_links(reference_invoice_id);

alter table public.invoice_reference_links enable row level security;

drop policy if exists "invoice_reference_links_all" on public.invoice_reference_links;
create policy "invoice_reference_links_all" on public.invoice_reference_links
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- مزامنة المراجع الإضافية (المرجع الرئيسي يبقى في invoices.reference_invoice_id)
-- ---------------------------------------------------------------------------

create or replace function public.sync_invoice_reference_links(
  p_invoice_id uuid,
  p_reference_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary uuid;
begin
  select reference_invoice_id into v_primary
  from public.invoices
  where id = p_invoice_id;

  delete from public.invoice_reference_links
  where invoice_id = p_invoice_id;

  if p_reference_ids is null or array_length(p_reference_ids, 1) is null then
    return;
  end if;

  insert into public.invoice_reference_links (invoice_id, reference_invoice_id, sort_order)
  select
    p_invoice_id,
    ref_id,
    ordinality - 1
  from unnest(p_reference_ids) with ordinality as t(ref_id, ordinality)
  where ref_id is not null
    and ref_id <> p_invoice_id
    and (v_primary is null or ref_id <> v_primary)
  on conflict (invoice_id, reference_invoice_id) do nothing;
end;
$$;

grant execute on function public.sync_invoice_reference_links(uuid, uuid[]) to authenticated;

-- =============================================================================
-- BEGIN patch_invoice_reference_close.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_reference_close.sql — إغلاق المرجع يدوياً
-- =============================================================================
-- يتطلب: patch_invoices.sql (#5)
-- الترتيب: patch #12
-- =============================================================================

alter table public.invoices
  add column if not exists reference_closed_at timestamptz null;

create index if not exists idx_invoices_reference_closed_at
  on public.invoices(reference_closed_at)
  where reference_closed_at is not null;

-- ---------------------------------------------------------------------------

create or replace function public.close_invoice_reference(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status <> 'posted' then
    raise exception 'Only posted invoices can be closed as reference.';
  end if;

  if v_inv.reference_closed_at is not null then
    raise exception 'Invoice reference is already closed.';
  end if;

  update public.invoices
  set reference_closed_at = now(),
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

grant execute on function public.close_invoice_reference(uuid) to authenticated;

-- =============================================================================
-- BEGIN patch_opening_entry.sql
-- =============================================================================
-- =============================================================================
-- patch_opening_entry.sql — قيد افتتاحي + فهرس per فرع/سنة
-- =============================================================================
-- يتطلب: patch_branches.sql، patch_journal_dimensions.sql
-- التالي: (اختياري) تحديث get_trial_balance لفصل حركة الافتتاح
-- =============================================================================

alter table public.vouchers
  add column if not exists is_opening_entry boolean not null default false;

alter table public.journal_entries
  add column if not exists is_opening_entry boolean not null default false;

comment on column public.vouchers.is_opening_entry is
  'سند قيد افتتاحي — ميزانية بداية الفترة';
comment on column public.journal_entries.is_opening_entry is
  'قيد مولّد من سند افتتاحي — يُفصل في ميزان المراجعة';

create index if not exists idx_vouchers_is_opening_entry
  on public.vouchers(is_opening_entry)
  where is_opening_entry = true;

create index if not exists idx_journal_entries_is_opening_entry
  on public.journal_entries(is_opening_entry)
  where is_opening_entry = true;

-- قيد افتتاحي مرحّل واحد per (فرع أو بدون فرع، سنة)
-- coalesce يغطي branch_id null — نفس نمط idx_accounting_periods_code_branch
drop index if exists public.idx_vouchers_opening_per_branch_year;
create unique index if not exists idx_vouchers_opening_per_branch_year
  on public.vouchers (
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    (extract(year from voucher_date)::int)
  )
  where is_opening_entry = true
    and status = 'posted';

-- نسخ العلامة إلى القيد عند الترحيل
create or replace function public.sync_voucher_journal_opening_flag()
returns trigger
language plpgsql
as $$
begin
  if new.journal_entry_id is not null and new.is_opening_entry then
    update public.journal_entries
    set is_opening_entry = true
    where id = new.journal_entry_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vouchers_sync_journal_opening on public.vouchers;
create trigger trg_vouchers_sync_journal_opening
after insert or update of journal_entry_id, is_opening_entry on public.vouchers
for each row execute function public.sync_voucher_journal_opening_flag();

-- =============================================================================
-- BEGIN patch_trial_balance_opening.sql
-- =============================================================================
-- =============================================================================
-- patch_trial_balance_opening.sql — عمود رصيد افتتاحي منفصل في ميزان المراجعة
-- =============================================================================
-- يتطلب: patch_opening_entry.sql (is_opening_entry على journal_entries)
-- =============================================================================

drop function if exists public.get_trial_balance(date, date, uuid, uuid, boolean, uuid) cascade;

create or replace function public.get_trial_balance(
  p_from_date date default null,
  p_to_date date default null,
  p_currency_id uuid default null,
  p_account_id uuid default null,
  p_account_subtree boolean default true,
  p_cost_center_id uuid default null
)
returns table (
  account_id uuid,
  account_code varchar,
  account_name varchar,
  currency_id uuid,
  parent_id uuid,
  is_postable boolean,
  opening_entry_balance numeric,
  opening_balance numeric,
  period_debit numeric,
  period_credit numeric,
  closing_balance numeric
)
language sql
stable
set search_path = public
as $$
  with scoped_accounts as (
    select a.*
    from public.accounts a
    where a.is_active = true
      and (p_currency_id is null or a.currency_id = p_currency_id)
      and (
        p_account_id is null
        or (
          p_account_subtree
          and a.id in (
            with recursive account_tree as (
              select id
              from public.accounts
              where id = p_account_id
              union all
              select child.id
              from public.accounts child
              inner join account_tree parent on child.parent_id = parent.id
            )
            select id from account_tree
          )
        )
        or (not p_account_subtree and a.id = p_account_id)
      )
  ),
  line_agg as (
    select
      jel.account_id,
      coalesce(sum(
        case
          when coalesce(je.is_opening_entry, false)
            then jel.debit_base - jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as opening_entry_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and p_from_date is not null
            and je.entry_date < p_from_date
            then jel.debit_base - jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as opening_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.debit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_debit,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.credit_base
          else 0
        end
      ), 0)::numeric(18, 2) as period_credit
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where je.status = 'posted'
      and (p_cost_center_id is null or jel.cost_center_id = p_cost_center_id)
    group by jel.account_id
  )
  select
    sa.id as account_id,
    sa.code as account_code,
    sa.name_ar as account_name,
    sa.currency_id,
    sa.parent_id,
    sa.is_postable,
    coalesce(la.opening_entry_balance, 0)::numeric(18, 2) as opening_entry_balance,
    coalesce(la.opening_balance, 0)::numeric(18, 2) as opening_balance,
    coalesce(la.period_debit, 0)::numeric(18, 2) as period_debit,
    coalesce(la.period_credit, 0)::numeric(18, 2) as period_credit,
    (
      coalesce(la.opening_entry_balance, 0)
      + coalesce(la.opening_balance, 0)
      + coalesce(la.period_debit, 0)
      - coalesce(la.period_credit, 0)
    )::numeric(18, 2) as closing_balance
  from scoped_accounts sa
  left join line_agg la on la.account_id = sa.id
  where sa.is_postable = true
  order by sa.code;
$$;

comment on function public.get_trial_balance is
  'ميزان مراجعة — opening_entry_balance منفصل عن حركة الفترة (يستثني is_opening_entry)';

-- =============================================================================
-- BEGIN patch_accounting_periods.sql
-- =============================================================================
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

-- =============================================================================
-- BEGIN patch_period_enforcement.sql
-- =============================================================================
-- =============================================================================
-- patch_period_enforcement.sql — قفل الفترة + قيود مقاصة CC/فرع عند الترحيل
-- =============================================================================
-- يتطلب: patch_accounting_periods.sql + patch_settlement_foundation.sql
-- =============================================================================

create or replace function public.assert_accounting_period_open(
  p_entry_date date,
  p_branch_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_closed record;
begin
  if p_entry_date is null then
    return;
  end if;

  select ap.period_code, ap.name_ar
  into v_closed
  from public.accounting_periods ap
  where ap.is_active = true
    and ap.status = 'closed'
    and p_entry_date between ap.start_date and ap.end_date
    and (
      ap.branch_id is null
      or (p_branch_id is not null and ap.branch_id = p_branch_id)
    )
  order by ap.branch_id nulls last
  limit 1;

  if found then
    raise exception 'Accounting period % (%) is closed for date %.',
      v_closed.period_code, v_closed.name_ar, p_entry_date;
  end if;
end;
$$;

comment on function public.assert_accounting_period_open(date, uuid) is
  'يمنع الترحيل داخل فترة محاسبية مغلقة (عامة أو للفرع)';

-- ---------------------------------------------------------------------------
-- ترحيل السند + قيود مقاصة CC/فرع
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
  v_netting record;
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        branch_id = new.branch_id,
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    perform public.assert_accounting_period_open(new.voucher_date, new.branch_id);

    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and coalesce(vl.line_description, '') not like 'تصفية —%'
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id,
      branch_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id,
      new.branch_id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      branch_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.branch_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    for v_netting in
      select *
      from public.voucher_netting_lines vnl
      where vnl.voucher_id = new.id
        and vnl.amount > 0
    loop
      if v_netting.inter_account_id is null then
        raise exception 'Netting line requires inter_account_id.';
      end if;

      if v_netting.netting_kind = 'cc' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة CC — مدين'),
          v_netting.to_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة CC — دائن'),
          v_netting.from_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      elsif v_netting.netting_kind = 'branch' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة فرع — مدين'),
          null,
          v_netting.to_branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة فرع — دائن'),
          null,
          v_netting.from_branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      end if;
    end loop;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- BEGIN patch_inventory_reports.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_reports.sql — تقارير مخزون + تسوية جردية
-- =============================================================================
-- يتطلب: patch_post_invoice.sql (inventory_movements)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- رصيد مخزون per مادة/مستودع
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_balance(date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_inventory_balance(
  p_as_of_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_category_id uuid default null,
  p_hide_zero boolean default true
)
returns table (
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  category_id uuid,
  category_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_id uuid,
  branch_code varchar,
  quantity_base numeric,
  inventory_value numeric,
  unit_cost_avg numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped_movements as (
    select im.*
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    where m.is_active = true
      and (p_as_of_date is null or im.movement_date <= p_as_of_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
      and (p_category_id is null or m.category_id = p_category_id)
  ),
  agg as (
    select
      sm.material_id,
      sm.warehouse_id,
      coalesce(sum(sm.quantity_base_delta), 0)::numeric(18, 6) as quantity_base,
      coalesce(
        sum(sm.quantity_base_delta * coalesce(sm.unit_cost, 0)),
        0
      )::numeric(18, 2) as inventory_value
    from scoped_movements sm
    group by sm.material_id, sm.warehouse_id
  )
  select
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    m.category_id,
    mc.name_ar as category_name_ar,
    w.id as warehouse_id,
    w.warehouse_code,
    w.name_ar as warehouse_name_ar,
    w.branch_id,
    b.branch_code,
    a.quantity_base,
    a.inventory_value,
    case
      when a.quantity_base <> 0 then
        round((a.inventory_value / a.quantity_base)::numeric, 4)
      else null
    end as unit_cost_avg
  from agg a
  inner join public.materials m on m.id = a.material_id
  inner join public.warehouses w on w.id = a.warehouse_id
  inner join public.branches b on b.id = w.branch_id
  left join public.material_categories mc on mc.id = m.category_id
  where (not p_hide_zero or a.quantity_base <> 0)
  order by m.material_code, w.warehouse_code;
$$;

comment on function public.get_inventory_balance is
  'رصيد مخزون مجمّع per مادة/مستودع — كمية أساس + قيمة تقديرية';

-- ---------------------------------------------------------------------------
-- دفتر حركة مادة في مستودع (مع رصيد تراكمي)
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_movement_ledger(date, date, uuid, uuid, uuid) cascade;

create or replace function public.get_inventory_movement_ledger(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_id uuid,
  movement_date date,
  movement_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base_delta numeric,
  unit_cost numeric,
  line_value numeric,
  running_balance_base numeric,
  source_type varchar,
  source_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      im.id as movement_id,
      im.movement_date,
      im.movement_kind,
      im.material_id,
      m.material_code,
      m.name_ar as material_name_ar,
      im.warehouse_id,
      w.warehouse_code,
      w.name_ar as warehouse_name_ar,
      b.branch_code,
      im.quantity_base_delta,
      im.unit_cost,
      round((im.quantity_base_delta * coalesce(im.unit_cost, 0))::numeric, 2) as line_value,
      im.source_type,
      im.source_id,
      im.created_at
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    where (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    f.movement_id,
    f.movement_date,
    f.movement_kind,
    f.material_id,
    f.material_code,
    f.material_name_ar,
    f.warehouse_id,
    f.warehouse_code,
    f.warehouse_name_ar,
    f.branch_code,
    f.quantity_base_delta,
    f.unit_cost,
    f.line_value,
    sum(f.quantity_base_delta) over (
      partition by f.material_id, f.warehouse_id
      order by f.movement_date, f.created_at, f.movement_id
      rows between unbounded preceding and current row
    )::numeric(18, 6) as running_balance_base,
    f.source_type,
    f.source_id,
    f.created_at
  from filtered f
  order by f.movement_date, f.created_at, f.movement_id;
$$;

comment on function public.get_inventory_movement_ledger is
  'دفتر حركات مخزون مع رصيد تراكمي per مادة/مستودع';

-- ---------------------------------------------------------------------------
-- تسوية جردية مباشرة (فروقات عدّ فعلي ↔ نظامي)
-- ---------------------------------------------------------------------------

drop function if exists public.post_stock_adjustment(
  uuid, uuid, numeric, uuid, uuid, date, text, uuid
) cascade;

create or replace function public.post_stock_adjustment(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_counted_quantity_base numeric,
  p_inventory_account_id uuid,
  p_adjustment_account_id uuid,
  p_adjustment_date date default current_date,
  p_description text default null,
  p_cost_center_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.materials%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_settings public.company_inventory_settings%rowtype;
  v_system_qty numeric(18, 6);
  v_delta numeric(18, 6);
  v_unit_cost numeric(18, 4);
  v_amount numeric(18, 2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_desc text;
begin
  if p_counted_quantity_base < 0 then
    raise exception 'Counted quantity cannot be negative.';
  end if;

  if p_inventory_account_id is null or p_adjustment_account_id is null then
    raise exception 'Inventory and adjustment accounts are required.';
  end if;

  select * into v_material
  from public.materials
  where id = p_material_id and is_active = true;
  if not found then
    raise exception 'Material not found or inactive.';
  end if;

  select * into v_warehouse
  from public.warehouses
  where id = p_warehouse_id and is_active = true;
  if not found then
    raise exception 'Warehouse not found or inactive.';
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;
  if v_settings.inventory_method is null then
    raise exception 'Configure inventory_method before stock adjustment.';
  end if;

  perform public.assert_accounting_period_open(p_adjustment_date, null);

  select coalesce(sum(im.quantity_base_delta), 0)
  into v_system_qty
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id;

  v_delta := round((p_counted_quantity_base - v_system_qty)::numeric, 6);

  if abs(v_delta) < 0.000001 then
    raise exception 'No adjustment needed — counted quantity matches system balance.';
  end if;

  select coalesce(
    (
      select sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
             / nullif(sum(im.quantity_base_delta), 0)
      from public.inventory_movements im
      where im.material_id = p_material_id
        and im.warehouse_id = p_warehouse_id
    ),
    v_material.purchase_price,
    0
  )
  into v_unit_cost;

  v_amount := round((abs(v_delta) * coalesce(v_unit_cost, 0))::numeric, 2);
  if v_amount <= 0 then
    raise exception 'Adjustment value is zero — set purchase price or post purchases first.';
  end if;

  v_desc := coalesce(
    p_description,
    'تسوية جرد — ' || v_material.material_code || ' @ ' || v_warehouse.warehouse_code
  );

  v_entry_no := 'JE-STKADJ-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    p_adjustment_date,
    v_desc,
    'posted',
    'stock_adjustment',
    p_material_id,
    v_warehouse.branch_id
  )
  returning id into v_je_id;

  if v_delta > 0 then
    perform public._invoice_add_journal_line(
      v_je_id, p_inventory_account_id, v_amount, 0,
      'فائض جرد — ' || v_material.material_code,
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
    perform public._invoice_add_journal_line(
      v_je_id, p_adjustment_account_id, 0, v_amount,
      'فائض جرد — طرف مقابل',
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
  else
    perform public._invoice_add_journal_line(
      v_je_id, p_adjustment_account_id, v_amount, 0,
      'عجز جرد — ' || v_material.material_code,
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
    perform public._invoice_add_journal_line(
      v_je_id, p_inventory_account_id, 0, v_amount,
      'عجز جرد — مخزون',
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
  end if;

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
    source_id
  )
  values (
    p_adjustment_date,
    p_material_id,
    p_warehouse_id,
    v_warehouse.branch_id,
    p_cost_center_id,
    v_delta,
    v_delta,
    v_unit_cost,
    v_amount,
    'adjustment',
    'stock_adjustment',
    v_je_id
  );

  perform public.lock_company_inventory_foundation(p_adjustment_date::timestamptz);

  return jsonb_build_object(
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'system_quantity_base', v_system_qty,
    'counted_quantity_base', p_counted_quantity_base,
    'delta_quantity_base', v_delta,
    'adjustment_amount', v_amount,
    'unit_cost', v_unit_cost
  );
end;
$$;

comment on function public.post_stock_adjustment is
  'ترحيل فروقات جرد — قيد + حركة adjustment عند اختلاف العدّ الفعلي عن الرصيد النظامي';

-- =============================================================================
-- BEGIN patch_inventory_phase2.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase2.sql — تسوية مجمّعة + تحليل نواقص/راكد
-- =============================================================================
-- يتطلب: patch_inventory_reports.sql + patch_period_enforcement.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تسوية جرد متعددة الأسطر — قيد واحد
-- ---------------------------------------------------------------------------

drop function if exists public.post_stock_adjustment_batch(jsonb, uuid, uuid, date, text, uuid) cascade;

create or replace function public.post_stock_adjustment_batch(
  p_lines jsonb,
  p_inventory_account_id uuid,
  p_adjustment_account_id uuid,
  p_adjustment_date date default current_date,
  p_description text default null,
  p_cost_center_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.company_inventory_settings%rowtype;
  v_line jsonb;
  v_material public.materials%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_system_qty numeric(18, 6);
  v_delta numeric(18, 6);
  v_unit_cost numeric(18, 4);
  v_amount numeric(18, 2);
  v_counted numeric(18, 6);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_desc text;
  v_line_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_branch_id uuid;
begin
  if p_inventory_account_id is null or p_adjustment_account_id is null then
    raise exception 'Inventory and adjustment accounts are required.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one adjustment line is required.';
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;
  if v_settings.inventory_method is null then
    raise exception 'Configure inventory_method before stock adjustment.';
  end if;

  perform public.assert_accounting_period_open(p_adjustment_date, null);

  v_entry_no := 'JE-STKADJ-BATCH-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  v_desc := coalesce(p_description, 'تسوية جرد مجمّعة');

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_material
    from public.materials
    where id = (v_line->>'material_id')::uuid and is_active = true;
    if not found then
      raise exception 'Material not found: %', v_line->>'material_id';
    end if;

    select * into v_warehouse
    from public.warehouses
    where id = (v_line->>'warehouse_id')::uuid and is_active = true;
    if not found then
      raise exception 'Warehouse not found: %', v_line->>'warehouse_id';
    end if;

    v_counted := (v_line->>'counted_quantity_base')::numeric;
    if v_counted < 0 then
      raise exception 'Counted quantity cannot be negative for material %.', v_material.material_code;
    end if;

    select coalesce(sum(im.quantity_base_delta), 0)
    into v_system_qty
    from public.inventory_movements im
    where im.material_id = v_material.id
      and im.warehouse_id = v_warehouse.id;

    v_delta := round((v_counted - v_system_qty)::numeric, 6);
    if abs(v_delta) < 0.000001 then
      continue;
    end if;

    select coalesce(
      (
        select sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
               / nullif(sum(im.quantity_base_delta), 0)
        from public.inventory_movements im
        where im.material_id = v_material.id
          and im.warehouse_id = v_warehouse.id
      ),
      v_material.purchase_price,
      0
    )
    into v_unit_cost;

    v_amount := round((abs(v_delta) * coalesce(v_unit_cost, 0))::numeric, 2);
    if v_amount <= 0 then
      raise exception 'Adjustment value is zero for material %.', v_material.material_code;
    end if;

    if v_je_id is null then
      v_branch_id := v_warehouse.branch_id;
      insert into public.journal_entries (
        entry_no, entry_date, description, status, source_type, source_id, branch_id
      )
      values (
        v_entry_no,
        p_adjustment_date,
        v_desc,
        'posted',
        'stock_adjustment_batch',
        gen_random_uuid(),
        v_branch_id
      )
      returning id into v_je_id;
    end if;

    if v_delta > 0 then
      perform public._invoice_add_journal_line(
        v_je_id, p_inventory_account_id, v_amount, 0,
        'فائض جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, p_adjustment_account_id, 0, v_amount,
        'فائض جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
    else
      perform public._invoice_add_journal_line(
        v_je_id, p_adjustment_account_id, v_amount, 0,
        'عجز جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, p_inventory_account_id, 0, v_amount,
        'عجز جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id
    )
    values (
      p_adjustment_date,
      v_material.id,
      v_warehouse.id,
      v_warehouse.branch_id,
      p_cost_center_id,
      v_delta,
      v_delta,
      v_unit_cost,
      v_amount,
      'adjustment',
      'stock_adjustment',
      v_je_id
    );

    v_applied := v_applied + 1;
    v_line_results := v_line_results || jsonb_build_array(
      jsonb_build_object(
        'material_id', v_material.id,
        'material_code', v_material.material_code,
        'warehouse_id', v_warehouse.id,
        'warehouse_code', v_warehouse.warehouse_code,
        'system_quantity_base', v_system_qty,
        'counted_quantity_base', v_counted,
        'delta_quantity_base', v_delta,
        'adjustment_amount', v_amount
      )
    );
  end loop;

  if v_applied = 0 then
    raise exception 'No adjustment lines with quantity difference.';
  end if;

  perform public.lock_company_inventory_foundation(p_adjustment_date::timestamptz);

  return jsonb_build_object(
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'applied_lines', v_applied,
    'lines', v_line_results
  );
end;
$$;

comment on function public.post_stock_adjustment_batch is
  'تسوية جرد متعددة الأسطر في قيد واحد';

-- ---------------------------------------------------------------------------
-- نواقص + مواد راكدة
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_analysis(date, numeric, int, uuid, uuid) cascade;

create or replace function public.get_inventory_analysis(
  p_as_of_date date default current_date,
  p_shortage_max_qty numeric default 0,
  p_stagnant_days int default 90,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  analysis_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base numeric,
  inventory_value numeric,
  last_movement_date date,
  days_idle int
)
language sql
stable
security definer
set search_path = public
as $$
  with balance as (
    select *
    from public.get_inventory_balance(
      p_as_of_date,
      null,
      p_warehouse_id,
      p_branch_id,
      null,
      false
    )
  ),
  last_move as (
    select
      im.material_id,
      im.warehouse_id,
      max(im.movement_date) as last_movement_date
    from public.inventory_movements im
    where (p_as_of_date is null or im.movement_date <= p_as_of_date)
    group by im.material_id, im.warehouse_id
  ),
  enriched as (
    select
      b.*,
      lm.last_movement_date,
      case
        when lm.last_movement_date is null then null
        else (p_as_of_date - lm.last_movement_date)::int
      end as days_idle
    from balance b
    left join last_move lm
      on lm.material_id = b.material_id
      and lm.warehouse_id = b.warehouse_id
  )
  select
    'shortage'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base <= coalesce(p_shortage_max_qty, 0)

  union all

  select
    'stagnant'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base > 0
    and coalesce(p_stagnant_days, 0) > 0
    and (
      e.last_movement_date is null
      or e.last_movement_date <= p_as_of_date - p_stagnant_days
    )

  order by analysis_kind, material_code, warehouse_code;
$$;

comment on function public.get_inventory_analysis is
  'نواقص (كمية <= حد) ومواد راكدة (بدون حركة منذ N يوم مع رصيد)';

-- =============================================================================
-- BEGIN patch_inventory_phase3.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase3.sql — حد أدنى للمخزون + تسوية batch متعددة الفروع
-- =============================================================================
-- يتطلب: patch_inventory_phase2.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- حد أدنى للمخزون per مادة
-- ---------------------------------------------------------------------------

alter table public.materials
  add column if not exists min_stock numeric(18, 6) not null default 0;

alter table public.materials
  drop constraint if exists materials_min_stock_nonneg;

alter table public.materials
  add constraint materials_min_stock_nonneg check (min_stock >= 0);

comment on column public.materials.min_stock is
  'الحد الأدنى للمخزون (وحدة أساس) — يُستخدم في تحليل النواقص';

-- ---------------------------------------------------------------------------
-- تحليل نواقص/راكد — يفضّل min_stock من بطاقة المادة
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_analysis(date, numeric, int, uuid, uuid) cascade;

create or replace function public.get_inventory_analysis(
  p_as_of_date date default current_date,
  p_shortage_max_qty numeric default 0,
  p_stagnant_days int default 90,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  analysis_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base numeric,
  min_stock numeric,
  inventory_value numeric,
  last_movement_date date,
  days_idle int
)
language sql
stable
security definer
set search_path = public
as $$
  with balance as (
    select *
    from public.get_inventory_balance(
      p_as_of_date,
      null,
      p_warehouse_id,
      p_branch_id,
      null,
      false
    )
  ),
  last_move as (
    select
      im.material_id,
      im.warehouse_id,
      max(im.movement_date) as last_movement_date
    from public.inventory_movements im
    where (p_as_of_date is null or im.movement_date <= p_as_of_date)
    group by im.material_id, im.warehouse_id
  ),
  enriched as (
    select
      b.*,
      coalesce(m.min_stock, 0) as min_stock,
      lm.last_movement_date,
      case
        when lm.last_movement_date is null then null
        else (p_as_of_date - lm.last_movement_date)::int
      end as days_idle
    from balance b
    join public.materials m on m.id = b.material_id
    left join last_move lm
      on lm.material_id = b.material_id
      and lm.warehouse_id = b.warehouse_id
  )
  select
    'shortage'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where (
    (e.min_stock > 0 and e.quantity_base < e.min_stock)
    or (e.min_stock = 0 and e.quantity_base <= coalesce(p_shortage_max_qty, 0))
  )

  union all

  select
    'stagnant'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base > 0
    and coalesce(p_stagnant_days, 0) > 0
    and (
      e.last_movement_date is null
      or e.last_movement_date <= p_as_of_date - p_stagnant_days
    )

  order by analysis_kind, material_code, warehouse_code;
$$;

comment on function public.get_inventory_analysis is
  'نواقص (أقل من min_stock أو حد عام) ومواد راكدة';

-- ---------------------------------------------------------------------------
-- تسوية مجمّعة — قيد واحد لعدة فروع + فحص فترة لكل فرع
-- ---------------------------------------------------------------------------

drop function if exists public.post_stock_adjustment_batch(jsonb, uuid, uuid, date, text, uuid) cascade;

create or replace function public.post_stock_adjustment_batch(
  p_lines jsonb,
  p_inventory_account_id uuid,
  p_adjustment_account_id uuid,
  p_adjustment_date date default current_date,
  p_description text default null,
  p_cost_center_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.company_inventory_settings%rowtype;
  v_line jsonb;
  v_material public.materials%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_system_qty numeric(18, 6);
  v_delta numeric(18, 6);
  v_unit_cost numeric(18, 4);
  v_amount numeric(18, 2);
  v_counted numeric(18, 6);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_desc text;
  v_line_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_branch_id uuid;
  v_branch_ids uuid[] := '{}';
  v_distinct_branches int := 0;
  v_check_branch uuid;
begin
  if p_inventory_account_id is null or p_adjustment_account_id is null then
    raise exception 'Inventory and adjustment accounts are required.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one adjustment line is required.';
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;
  if v_settings.inventory_method is null then
    raise exception 'Configure inventory_method before stock adjustment.';
  end if;

  select coalesce(array_agg(distinct w.branch_id), '{}')
  into v_branch_ids
  from jsonb_array_elements(p_lines) as elem
  join public.warehouses w
    on w.id = (elem.value->>'warehouse_id')::uuid
   and w.is_active = true;

  v_distinct_branches := coalesce(array_length(v_branch_ids, 1), 0);

  perform public.assert_accounting_period_open(p_adjustment_date, null);
  foreach v_check_branch in array v_branch_ids
  loop
    perform public.assert_accounting_period_open(p_adjustment_date, v_check_branch);
  end loop;

  v_entry_no := 'JE-STKADJ-BATCH-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  v_desc := coalesce(p_description, 'تسوية جرد مجمّعة');

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_material
    from public.materials
    where id = (v_line->>'material_id')::uuid and is_active = true;
    if not found then
      raise exception 'Material not found: %', v_line->>'material_id';
    end if;

    select * into v_warehouse
    from public.warehouses
    where id = (v_line->>'warehouse_id')::uuid and is_active = true;
    if not found then
      raise exception 'Warehouse not found: %', v_line->>'warehouse_id';
    end if;

    v_counted := (v_line->>'counted_quantity_base')::numeric;
    if v_counted < 0 then
      raise exception 'Counted quantity cannot be negative for material %.', v_material.material_code;
    end if;

    select coalesce(sum(im.quantity_base_delta), 0)
    into v_system_qty
    from public.inventory_movements im
    where im.material_id = v_material.id
      and im.warehouse_id = v_warehouse.id;

    v_delta := round((v_counted - v_system_qty)::numeric, 6);
    if abs(v_delta) < 0.000001 then
      continue;
    end if;

    select coalesce(
      (
        select sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
               / nullif(sum(im.quantity_base_delta), 0)
        from public.inventory_movements im
        where im.material_id = v_material.id
          and im.warehouse_id = v_warehouse.id
      ),
      v_material.purchase_price,
      0
    )
    into v_unit_cost;

    v_amount := round((abs(v_delta) * coalesce(v_unit_cost, 0))::numeric, 2);
    if v_amount <= 0 then
      raise exception 'Adjustment value is zero for material %.', v_material.material_code;
    end if;

    if v_je_id is null then
      v_branch_id := case
        when v_distinct_branches > 1 then null
        else v_branch_ids[1]
      end;

      insert into public.journal_entries (
        entry_no, entry_date, description, status, source_type, source_id, branch_id
      )
      values (
        v_entry_no,
        p_adjustment_date,
        v_desc,
        'posted',
        'stock_adjustment_batch',
        gen_random_uuid(),
        v_branch_id
      )
      returning id into v_je_id;
    end if;

    if v_delta > 0 then
      perform public._invoice_add_journal_line(
        v_je_id, p_inventory_account_id, v_amount, 0,
        'فائض جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, p_adjustment_account_id, 0, v_amount,
        'فائض جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
    else
      perform public._invoice_add_journal_line(
        v_je_id, p_adjustment_account_id, v_amount, 0,
        'عجز جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, p_inventory_account_id, 0, v_amount,
        'عجز جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id
    )
    values (
      p_adjustment_date,
      v_material.id,
      v_warehouse.id,
      v_warehouse.branch_id,
      p_cost_center_id,
      v_delta,
      v_delta,
      v_unit_cost,
      v_amount,
      'adjustment',
      'stock_adjustment',
      v_je_id
    );

    v_applied := v_applied + 1;
    v_line_results := v_line_results || jsonb_build_array(
      jsonb_build_object(
        'material_id', v_material.id,
        'material_code', v_material.material_code,
        'warehouse_id', v_warehouse.id,
        'warehouse_code', v_warehouse.warehouse_code,
        'branch_id', v_warehouse.branch_id,
        'system_quantity_base', v_system_qty,
        'counted_quantity_base', v_counted,
        'delta_quantity_base', v_delta,
        'adjustment_amount', v_amount
      )
    );
  end loop;

  if v_applied = 0 then
    raise exception 'No adjustment lines with quantity difference.';
  end if;

  perform public.lock_company_inventory_foundation(p_adjustment_date::timestamptz);

  return jsonb_build_object(
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'applied_lines', v_applied,
    'branch_count', v_distinct_branches,
    'lines', v_line_results
  );
end;
$$;

comment on function public.post_stock_adjustment_batch is
  'تسوية جرد متعددة الأسطر — قيد واحد يدعم عدة فروع';

-- =============================================================================
-- BEGIN patch_inventory_phase4.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase4.sql — تقرير تكلفة المبيعات (COGS)
-- =============================================================================
-- يتطلب: patch_post_invoice.sql (حركات sale / return_sale)
-- =============================================================================

drop function if exists public.get_cogs_report(date, date, uuid, uuid, uuid, varchar) cascade;

create or replace function public.get_cogs_report(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_group_by varchar default 'material'
)
returns table (
  group_key varchar,
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  sale_quantity_base numeric,
  return_quantity_base numeric,
  sales_amount numeric,
  cogs_amount numeric,
  return_cogs_amount numeric,
  net_cogs numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      im.movement_kind,
      im.quantity_base_delta,
      im.unit_cost,
      im.total_cost,
      im.material_id,
      im.source_id as invoice_id,
      m.material_code,
      m.name_ar as material_name_ar,
      w.warehouse_code,
      b.branch_code,
      i.invoice_no,
      i.invoice_date
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    left join public.invoices i
      on im.source_type = 'invoice' and i.id = im.source_id
    where im.movement_kind in ('sale', 'return_sale')
      and (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    case
      when coalesce(p_group_by, 'material') = 'invoice' then
        coalesce(max(s.invoice_no), max(s.invoice_id::text))
      else max(s.material_code)
    end::varchar as group_key,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then (max(s.invoice_id::text))::uuid
      else null::uuid
    end as invoice_id,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_no)
      else null::varchar
    end as invoice_no,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_date)
      else null::date
    end as invoice_date,
    case
      when coalesce(p_group_by, 'material') = 'material' then (max(s.material_id::text))::uuid
      else null::uuid
    end as material_id,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_code)
      else null::varchar
    end as material_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_name_ar)
      else null::varchar
    end as material_name_ar,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.warehouse_code)
      else null::varchar
    end as warehouse_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.branch_code)
      else null::varchar
    end as branch_code,
    coalesce(
      sum(case when s.movement_kind = 'sale' then abs(s.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as sale_quantity_base,
    coalesce(
      sum(case when s.movement_kind = 'return_sale' then s.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as return_quantity_base,
    coalesce(
      sum(case when s.movement_kind = 'sale' then coalesce(s.total_cost, 0) else 0 end),
      0
    )::numeric(18, 2) as sales_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'return_sale' then
            round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as return_cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          when s.movement_kind = 'return_sale' then
            -round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as net_cogs
  from scoped s
  group by
    case
      when coalesce(p_group_by, 'material') = 'invoice' then s.invoice_id::text
      else s.material_id::text
    end
  order by group_key;
$$;

comment on function public.get_cogs_report is
  'تكلفة المبيعات من حركات sale/return_sale — مجمّع per مادة أو per فاتورة';

-- =============================================================================
-- BEGIN patch_inventory_phase5.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase5.sql — حد أدنى per مستودع + ملخص حركات المخزون
-- =============================================================================
-- يتطلب: patch_inventory_phase4.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- حد أدنى per مادة + مستودع
-- ---------------------------------------------------------------------------

create table if not exists public.warehouse_material_limits (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  min_stock numeric(18, 6) not null default 0 check (min_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_material_limits_unique unique (warehouse_id, material_id)
);

comment on table public.warehouse_material_limits is
  'حد أدنى للمخزون per مادة ومستودع — يتفوّق على min_stock في بطاقة المادة';

create index if not exists idx_warehouse_material_limits_wh
  on public.warehouse_material_limits(warehouse_id);
create index if not exists idx_warehouse_material_limits_mat
  on public.warehouse_material_limits(material_id);

alter table public.warehouse_material_limits enable row level security;

drop policy if exists "warehouse_material_limits_select_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_select_all" on public.warehouse_material_limits
  for select to authenticated using (true);
drop policy if exists "warehouse_material_limits_insert_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_insert_all" on public.warehouse_material_limits
  for insert to authenticated with check (true);
drop policy if exists "warehouse_material_limits_update_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_update_all" on public.warehouse_material_limits
  for update to authenticated using (true) with check (true);
drop policy if exists "warehouse_material_limits_delete_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_delete_all" on public.warehouse_material_limits
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- تحليل نواقص — أولوية: مستودع > بطاقة مادة > حد عام
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_analysis(date, numeric, int, uuid, uuid) cascade;

create or replace function public.get_inventory_analysis(
  p_as_of_date date default current_date,
  p_shortage_max_qty numeric default 0,
  p_stagnant_days int default 90,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  analysis_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base numeric,
  min_stock numeric,
  inventory_value numeric,
  last_movement_date date,
  days_idle int
)
language sql
stable
security definer
set search_path = public
as $$
  with balance as (
    select *
    from public.get_inventory_balance(
      p_as_of_date,
      null,
      p_warehouse_id,
      p_branch_id,
      null,
      false
    )
  ),
  last_move as (
    select
      im.material_id,
      im.warehouse_id,
      max(im.movement_date) as last_movement_date
    from public.inventory_movements im
    where (p_as_of_date is null or im.movement_date <= p_as_of_date)
    group by im.material_id, im.warehouse_id
  ),
  enriched as (
    select
      b.*,
      coalesce(
        nullif(wml.min_stock, 0),
        nullif(m.min_stock, 0),
        0
      ) as min_stock,
      lm.last_movement_date,
      case
        when lm.last_movement_date is null then null
        else (p_as_of_date - lm.last_movement_date)::int
      end as days_idle
    from balance b
    join public.materials m on m.id = b.material_id
    left join public.warehouse_material_limits wml
      on wml.material_id = b.material_id
     and wml.warehouse_id = b.warehouse_id
    left join last_move lm
      on lm.material_id = b.material_id
      and lm.warehouse_id = b.warehouse_id
  )
  select
    'shortage'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where (
    (e.min_stock > 0 and e.quantity_base < e.min_stock)
    or (e.min_stock = 0 and e.quantity_base <= coalesce(p_shortage_max_qty, 0))
  )

  union all

  select
    'stagnant'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base > 0
    and coalesce(p_stagnant_days, 0) > 0
    and (
      e.last_movement_date is null
      or e.last_movement_date <= p_as_of_date - p_stagnant_days
    )

  order by analysis_kind, material_code, warehouse_code;
$$;

comment on function public.get_inventory_analysis is
  'نواقص (حد مستودع/مادة أو حد عام) ومواد راكدة';

-- ---------------------------------------------------------------------------
-- ملخص حركات المخزون — per نوع حركة ونوع فاتورة
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_movements_summary(date, date, uuid, uuid, uuid) cascade;

create or replace function public.get_inventory_movements_summary(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_kind varchar,
  source_type varchar,
  commercial_kind varchar,
  movement_count bigint,
  quantity_in_base numeric,
  quantity_out_base numeric,
  total_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    im.movement_kind,
    im.source_type,
    coalesce(ip.commercial_kind, im.source_type)::varchar as commercial_kind,
    count(*)::bigint as movement_count,
    coalesce(
      sum(case when im.quantity_base_delta > 0 then im.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as quantity_in_base,
    coalesce(
      sum(case when im.quantity_base_delta < 0 then abs(im.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as quantity_out_base,
    coalesce(sum(coalesce(im.total_cost, 0)), 0)::numeric(18, 2) as total_value
  from public.inventory_movements im
  inner join public.materials m on m.id = im.material_id
  left join public.invoices i
    on im.source_type = 'invoice' and i.id = im.source_id
  left join public.invoice_patterns ip on ip.id = i.pattern_id
  where m.is_active = true
    and (p_from_date is null or im.movement_date >= p_from_date)
    and (p_to_date is null or im.movement_date <= p_to_date)
    and (p_material_id is null or im.material_id = p_material_id)
    and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or im.branch_id = p_branch_id)
  group by im.movement_kind, im.source_type, coalesce(ip.commercial_kind, im.source_type)
  order by commercial_kind, movement_kind;
$$;

comment on function public.get_inventory_movements_summary is
  'ملخص حركات المخزون مجمّع per نوع حركة ونوع فاتورة/مصدر';

-- =============================================================================
-- BEGIN patch_inventory_phase6.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase6.sql — تقرير مشتريات تفصيلي (أسطر فواتير)
-- =============================================================================
-- يتطلب: patch_post_invoice.sql
-- =============================================================================

drop function if exists public.get_purchase_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_purchase_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_vendor_id uuid default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_include_returns boolean default true
)
returns table (
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  commercial_kind varchar,
  vendor_name_ar varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  quantity_base numeric,
  unit_price numeric,
  discount_amount numeric,
  line_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id as invoice_id,
    i.invoice_no,
    i.invoice_date,
    ip.commercial_kind,
    coalesce(v.name_ar, '—')::varchar as vendor_name_ar,
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    w.warehouse_code,
    b.branch_code,
    iml.quantity_base,
    iml.unit_price,
    coalesce(iml.discount_amount, 0)::numeric(18, 2) as discount_amount,
    iml.line_amount
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.invoice_material_lines iml on iml.invoice_id = i.id
  inner join public.materials m on m.id = iml.material_id
  inner join public.warehouses w on w.id = iml.warehouse_id
  inner join public.branches b on b.id = iml.branch_id
  left join public.vendors v on v.id = i.vendor_id
  where i.status = 'posted'
    and (
      ip.commercial_kind in ('purchase', 'opening_stock')
      or (
        coalesce(p_include_returns, true)
        and ip.commercial_kind = 'return_purchase'
      )
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_vendor_id is null or i.vendor_id = p_vendor_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
$$;

comment on function public.get_purchase_lines_report is
  'أسطر فواتير مشتريات/مرتجع مشتريات/بضاعة أول المدة المرحّلة';

-- =============================================================================
-- BEGIN patch_inventory_phase7.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_phase7.sql — تقرير مبيعات تفصيلي (أسطر فواتير)
-- =============================================================================
-- يتطلب: patch_post_invoice.sql
-- =============================================================================

drop function if exists public.get_sales_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_sales_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_customer_id uuid default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_include_returns boolean default true
)
returns table (
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  commercial_kind varchar,
  customer_name_ar varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  quantity_base numeric,
  unit_price numeric,
  discount_amount numeric,
  line_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id as invoice_id,
    i.invoice_no,
    i.invoice_date,
    ip.commercial_kind,
    coalesce(c.name_ar, '—')::varchar as customer_name_ar,
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    w.warehouse_code,
    b.branch_code,
    iml.quantity_base,
    iml.unit_price,
    coalesce(iml.discount_amount, 0)::numeric(18, 2) as discount_amount,
    iml.line_amount
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.invoice_material_lines iml on iml.invoice_id = i.id
  inner join public.materials m on m.id = iml.material_id
  inner join public.warehouses w on w.id = iml.warehouse_id
  inner join public.branches b on b.id = iml.branch_id
  left join public.customers c on c.id = i.customer_id
  where i.status = 'posted'
    and (
      ip.commercial_kind = 'sale'
      or (
        coalesce(p_include_returns, true)
        and ip.commercial_kind = 'return_sale'
      )
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_customer_id is null or i.customer_id = p_customer_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
$$;

comment on function public.get_sales_lines_report is
  'أسطر فواتير مبيعات/مرتجع مبيعات المرحّلة';

-- =============================================================================
-- BEGIN patch_audit_fixes.sql
-- =============================================================================
-- =============================================================================
-- patch_audit_fixes.sql — إصلاحات تدقيق أمني ومحاسبي (#24)
-- =============================================================================
-- 1) RLS: authenticated فقط (يُطبَّق عبر 02_rls.sql المحدَّث — هذا الملف للقواعد المحاسبية)
-- 2) account_direct_balances + get_trial_balance: debit_base / credit_base
-- 3) دورة حياة الحساب: ورقة↔أب مشروطة بعدم وجود حركة
-- =============================================================================

-- ---------------------------------------------------------------------------
-- عرض الأرصدة — عملة أساس
-- ---------------------------------------------------------------------------

create or replace view public.account_direct_balances
with (security_invoker = true)
as
select
  jel.account_id,
  coalesce(sum(jel.debit_base), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit_base), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit_base - jel.credit_base), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;

-- ---------------------------------------------------------------------------
-- مساعد: هل الحساب عليه حركة قيد؟
-- ---------------------------------------------------------------------------

create or replace function public.account_has_journal_movements(p_account_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_entry_lines l
    where l.account_id = p_account_id
  );
$$;

grant execute on function public.account_has_journal_movements(uuid) to authenticated;

create or replace function public.get_account_ids_with_journal_movements()
returns table (account_id uuid)
language sql
stable
set search_path = public
as $$
  select distinct l.account_id
  from public.journal_entry_lines l;
$$;

grant execute on function public.get_account_ids_with_journal_movements() to authenticated;

-- ---------------------------------------------------------------------------
-- قواعد التسلسل الهرمي للحسابات
-- ---------------------------------------------------------------------------

create or replace function public.accounts_apply_hierarchy_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_is_postable boolean;
  v_has_children boolean;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Account cannot be parent of itself.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants as (
          select id, parent_id
          from public.accounts
          where parent_id = old.id
          union all
          select a.id, a.parent_id
          from public.accounts a
          inner join descendants d on a.parent_id = d.id
        )
        select 1
        from descendants
        where id = new.parent_id
      ) then
        raise exception 'Circular hierarchy is not allowed.';
      end if;
    end if;

    select is_postable
    into v_parent_is_postable
    from public.accounts
    where id = new.parent_id;

    if v_parent_is_postable then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = new.parent_id
      ) then
        raise exception 'Parent account has journal entries and cannot have child accounts.';
      end if;
    end if;

    new.level := coalesce((select level + 1 from public.accounts where id = new.parent_id), 1);
  else
    new.level := 1;
  end if;

  if tg_op = 'UPDATE' then
    select exists (
      select 1 from public.accounts c where c.parent_id = old.id
    ) into v_has_children;

    if v_has_children and new.is_postable then
      raise exception 'Parent account cannot be postable.';
    end if;

    if old.is_postable = true and new.is_postable = false then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = old.id
      ) then
        raise exception 'Cannot change postable account to parent while it has journal entries.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ميزان المراجعة — يُعاد من patch_trial_balance_opening.sql إن وُجد
-- (لا نكرر هنا لتجنب تعارض التوقيع)
-- ---------------------------------------------------------------------------

-- =============================================================================
-- BEGIN patch_voucher_allocation_cap.sql
-- =============================================================================
-- =============================================================================
-- patch_voucher_allocation_cap.sql — منع تجاوز التخصيص لمبلغ الحركة المفتوح (#25)
-- =============================================================================
-- يحمي من race condition (تبويبان / مستخدمان) عند إغلاق الحركات.
-- =============================================================================

create or replace function public.validate_allocation_row_capacity(
  p_voucher_id uuid,
  p_target_journal_line_id uuid,
  p_applied_amount numeric,
  p_exclude_allocation_id uuid default null,
  p_lock_line boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
  v_voucher_line_total numeric(18, 2);
begin
  if p_applied_amount < 0 then
    raise exception 'Applied allocation amount cannot be negative.';
  end if;

  if p_applied_amount = 0 and p_exclude_allocation_id is null then
    raise exception 'Applied allocation amount must be positive.';
  end if;

  if p_lock_line then
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted'
    for update of jel;
  else
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted';
  end if;

  if v_original is null then
    raise exception 'Target journal line is not a posted entry line.';
  end if;

  select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
  into v_posted
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where va.target_journal_line_id = p_target_journal_line_id
    and v.status = 'posted'
    and v.id <> p_voucher_id;

  select
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) + p_applied_amount
  into v_voucher_line_total
  from public.voucher_allocations va
  where va.voucher_id = p_voucher_id
    and va.target_journal_line_id = p_target_journal_line_id
    and (p_exclude_allocation_id is null or va.id <> p_exclude_allocation_id);

  if v_posted + v_voucher_line_total > v_original + 0.01 then
    raise exception
      'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
      v_posted + v_voucher_line_total,
      v_original,
      greatest(v_original - v_posted, 0);
  end if;
end;
$$;

create or replace function public.validate_voucher_allocations_capacity(
  p_voucher_id uuid,
  p_lock_lines boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
begin
  for r in
    select
      va.target_journal_line_id,
      sum(va.applied_amount)::numeric(18, 2) as line_total
    from public.voucher_allocations va
    where va.voucher_id = p_voucher_id
    group by va.target_journal_line_id
  loop
    if r.line_total <= 0 then
      raise exception 'Applied allocation amount must be positive.';
    end if;

    if p_lock_lines then
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted'
      for update of jel;
    else
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted';
    end if;

    if v_original is null then
      raise exception 'Target journal line is not a posted entry line.';
    end if;

    select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
    into v_posted
    from public.voucher_allocations va
    inner join public.vouchers v on v.id = va.voucher_id
    where va.target_journal_line_id = r.target_journal_line_id
      and v.status = 'posted'
      and v.id <> p_voucher_id;

    if v_posted + r.line_total > v_original + 0.01 then
      raise exception
        'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
        v_posted + r.line_total,
        v_original,
        greatest(v_original - v_posted, 0);
    end if;
  end loop;
end;
$$;

grant execute on function public.validate_allocation_row_capacity(uuid, uuid, numeric, uuid, boolean)
  to authenticated;
grant execute on function public.validate_voucher_allocations_capacity(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز التخصيصات
-- ---------------------------------------------------------------------------

create or replace function public.voucher_allocations_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_voucher_status varchar(20);
  v_settlement_mode varchar(20);
begin
  select status, settlement_mode
  into v_voucher_status, v_settlement_mode
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status = 'posted'
    and not public.is_admin()
    and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
  end if;

  if tg_op = 'UPDATE'
    and old.target_journal_line_id is distinct from new.target_journal_line_id then
    perform public.validate_allocation_row_capacity(
      new.voucher_id,
      old.target_journal_line_id,
      0,
      old.id,
      false
    );
  end if;

  perform public.validate_allocation_row_capacity(
    new.voucher_id,
    new.target_journal_line_id,
    new.applied_amount,
    case when tg_op = 'UPDATE' then old.id else null end,
    false
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- تحقق عند الترحيل (مع قفل السطر — يمنع التزامن)
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;

      perform public.validate_voucher_allocations_capacity(new.id, true);
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and coalesce(vl.line_description, '') not like 'تصفية —%'
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

comment on function public.validate_allocation_row_capacity is
  'يرفض تخصيصاً يتجاوز المبلغ الأصلي للسطر بعد خصم التخصيصات المرحّلة';

comment on function public.validate_voucher_allocations_capacity is
  'يتحقق من كل تخصيصات السند قبل الترحيل — مع قفل اختياري لمنع التزامن';

-- =============================================================================
-- BEGIN patch_voucher_line_cc_optional.sql
-- =============================================================================
-- =============================================================================
-- patch_voucher_line_cc_optional.sql (#26)
-- =============================================================================
-- استبدال شرط مركز الكلفة المعتمد على نص «تصفية —%» بعلم cc_optional صريح.
-- =============================================================================

alter table public.voucher_lines
  add column if not exists cc_optional boolean not null default false;

comment on column public.voucher_lines.cc_optional is
  'عند true يُعفى السطر من إلزامية مركز الكلفة (مثلاً أسطر حساب التصفية المقابلة)';

update public.voucher_lines
set cc_optional = true
where coalesce(line_description, '') like 'تصفية —%';

-- ---------------------------------------------------------------------------
-- مزامنة قيود السندات المرحّلة
-- ---------------------------------------------------------------------------

create or replace function public.sync_posted_voucher_journal(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if not public.is_admin() then
    raise exception 'Only administrators can sync posted voucher journals.';
  end if;

  select *
  into v_voucher
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_voucher.status <> 'posted' then
    raise exception 'Voucher is not posted.';
  end if;

  if v_voucher.journal_entry_id is null then
    raise exception 'Posted voucher has no linked journal entry.';
  end if;

  v_rate := coalesce(nullif(v_voucher.exchange_rate, 0), 1);

  select
    coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
    coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
  into v_debit, v_credit
  from public.voucher_lines
  where voucher_id = p_voucher_id;

  if v_debit = 0 and v_credit = 0 then
    raise exception 'Cannot sync empty voucher.';
  end if;

  if v_debit <> v_credit then
    raise exception 'Cannot sync unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
  end if;

  if v_voucher.voucher_type = 'settlement' then
    if exists (
      select 1
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is null
        and vl.amount > 0
        and not coalesce(vl.cc_optional, false)
    ) then
      raise exception 'Settlement voucher lines require a cost center.';
    end if;

    select count(*)
    into v_unbalanced_cc
    from (
      select
        vl.cost_center_id,
        coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
        coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is not null
      group by vl.cost_center_id
    ) cc
    where cc.debit_total <> cc.credit_total;

    if v_unbalanced_cc > 0 then
      raise exception 'Cannot sync settlement voucher: cost centers must balance.';
    end if;
  end if;

  delete from public.journal_entry_lines
  where journal_entry_id = v_voucher.journal_entry_id;

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    line_description,
    cost_center_id,
    currency_id,
    exchange_rate,
    debit_base,
    credit_base
  )
  select
    v_voucher.journal_entry_id,
    vl.account_id,
    case when vl.side = 'debit' then vl.amount else 0 end as debit,
    case when vl.side = 'credit' then vl.amount else 0 end as credit,
    trim(both from concat_ws(
      ' — ',
      nullif(trim(vl.line_description), ''),
      case
        when vlc.name_ar is not null then
          'نوع: ' || vlc.name_ar ||
          case
            when vl.category_quantity is not null and vl.category_quantity > 0 then
              ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
              ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
            else ''
          end
        else null
      end
    )),
    vl.cost_center_id,
    v_voucher.currency_id,
    v_rate,
    case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
    case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
  from public.voucher_lines vl
  left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
  where vl.voucher_id = p_voucher_id;

  update public.journal_entries
  set
    entry_date = v_voucher.voucher_date,
    description = coalesce(
      v_voucher.description,
      'Auto-posted from voucher ' || v_voucher.voucher_no
    ),
    updated_at = now()
  where id = v_voucher.journal_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- تحقق عند الترحيل
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;

      perform public.validate_voucher_allocations_capacity(new.id, true);
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and not coalesce(vl.cc_optional, false)
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- BEGIN patch_reverse_voucher_rpc.sql
-- =============================================================================
-- =============================================================================
-- patch_reverse_voucher_rpc.sql (#27)
-- =============================================================================
-- عكس السند المرحّل ذرّياً: إنشاء سند معكوس + أسطر + ترحيل في معاملة واحدة.
-- =============================================================================

create or replace function public.reverse_posted_voucher(p_voucher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.vouchers%rowtype;
  v_new_id uuid;
  v_new_no varchar(40);
  v_suffix text;
begin
  if not public.has_permission('vouchers.edit') then
    raise exception 'Permission denied: vouchers.edit required.';
  end if;

  select * into v_src from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_src.status <> 'posted' then
    raise exception 'Only posted vouchers can be reversed.';
  end if;

  if v_src.settlement_mode = 'invoice' then
    raise exception
      'Invoice settlement vouchers cannot be reversed automatically.';
  end if;

  v_suffix := right(
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    6
  );
  v_new_no := 'RV-' || v_src.voucher_no || '-' || v_suffix;
  if length(v_new_no) > 40 then
    v_new_no := left(v_new_no, 40);
  end if;

  insert into public.vouchers (
    voucher_no,
    voucher_type,
    settlement_mode,
    voucher_date,
    description,
    status,
    customer_id,
    vendor_id,
    currency_id,
    exchange_rate,
    cost_center_id,
    branch_id
  )
  values (
    v_new_no,
    v_src.voucher_type,
    v_src.settlement_mode,
    current_date,
    'عكس السند ' || v_src.voucher_no,
    'approved',
    v_src.customer_id,
    v_src.vendor_id,
    v_src.currency_id,
    v_src.exchange_rate,
    v_src.cost_center_id,
    v_src.branch_id
  )
  returning id into v_new_id;

  insert into public.voucher_lines (
    voucher_id,
    account_id,
    side,
    amount,
    line_description,
    cost_center_id,
    line_category_id,
    category_quantity,
    cc_optional
  )
  select
    v_new_id,
    vl.account_id,
    case when vl.side = 'debit' then 'credit' else 'debit' end,
    vl.amount,
    coalesce('عكس: ' || nullif(trim(vl.line_description), ''), 'عكس سطر'),
    vl.cost_center_id,
    vl.line_category_id,
    vl.category_quantity,
    vl.cc_optional
  from public.voucher_lines vl
  where vl.voucher_id = p_voucher_id;

  update public.vouchers
  set status = 'posted', updated_at = now()
  where id = v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.reverse_posted_voucher(uuid) to authenticated;

comment on function public.reverse_posted_voucher(uuid) is
  'ينشئ سنداً عكسياً مرحّلاً لسند مرحّل (ما عدا سندات إغلاق الفواتير)';

-- =============================================================================
-- BEGIN patch_voucher_atomic_ops.sql
-- =============================================================================
-- =============================================================================
-- patch_voucher_atomic_ops.sql (#28)
-- =============================================================================
-- عمليات ذرّية: استبدال أسطر/تخصيصات السند، واستيراد حسابات دفعة واحدة.
-- =============================================================================

create or replace function public.replace_voucher_lines(
  p_voucher_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_line jsonb;
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace lines on posted voucher.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines payload must be a JSON array.';
  end if;

  delete from public.voucher_lines
  where voucher_id = p_voucher_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if coalesce(v_line->>'account_id', '') = '' then
      continue;
    end if;

    if coalesce((v_line->>'amount')::numeric(18, 2), 0) <= 0 then
      continue;
    end if;

    insert into public.voucher_lines (
      voucher_id,
      account_id,
      side,
      amount,
      line_description,
      cost_center_id,
      line_category_id,
      category_quantity,
      cc_optional
    )
    values (
      p_voucher_id,
      (v_line->>'account_id')::uuid,
      v_line->>'side',
      (v_line->>'amount')::numeric(18, 2),
      nullif(trim(v_line->>'line_description'), ''),
      nullif(v_line->>'cost_center_id', '')::uuid,
      nullif(v_line->>'line_category_id', '')::uuid,
      nullif(v_line->>'category_quantity', '')::numeric(18, 4),
      coalesce((v_line->>'cc_optional')::boolean, false)
    );
  end loop;
end;
$$;

create or replace function public.replace_voucher_allocations(
  p_voucher_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status varchar(20);
  v_row jsonb;
  v_target_id uuid;
  v_amount numeric(18, 2);
begin
  select status
  into v_status
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_status = 'posted' then
    raise exception 'Cannot replace allocations on posted voucher.';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Allocations payload must be a JSON array.';
  end if;

  delete from public.voucher_allocations
  where voucher_id = p_voucher_id;

  for v_row in select value from jsonb_array_elements(p_allocations)
  loop
    v_target_id := nullif(v_row->>'target_journal_line_id', '')::uuid;
    v_amount := coalesce((v_row->>'applied_amount')::numeric(18, 2), 0);

    if v_target_id is null or v_amount <= 0 then
      continue;
    end if;

    insert into public.voucher_allocations (
      voucher_id,
      target_journal_line_id,
      applied_amount,
      note
    )
    values (
      p_voucher_id,
      v_target_id,
      v_amount,
      nullif(trim(v_row->>'note'), '')
    );
  end loop;
end;
$$;

create or replace function public.bulk_create_accounts(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_account public.accounts%rowtype;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Accounts payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one account row is required.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(trim(v_row->>'code'), '') = '' then
      raise exception 'Account code is required.';
    end if;

    if coalesce(trim(v_row->>'name_ar'), '') = '' then
      raise exception 'Account name_ar is required.';
    end if;

    if coalesce(v_row->>'parent_id', '') = '' then
      raise exception 'Account parent_id is required.';
    end if;

    insert into public.accounts (
      code,
      sub_code,
      name_ar,
      name_en,
      parent_id,
      currency_id,
      is_postable,
      is_active
    )
    values (
      trim(v_row->>'code'),
      nullif(trim(v_row->>'sub_code'), ''),
      trim(v_row->>'name_ar'),
      nullif(trim(v_row->>'name_en'), ''),
      (v_row->>'parent_id')::uuid,
      nullif(v_row->>'currency_id', '')::uuid,
      coalesce((v_row->>'is_postable')::boolean, true),
      coalesce((v_row->>'is_active')::boolean, true)
    )
    returning * into v_account;

    v_result := v_result || jsonb_build_array(to_jsonb(v_account));
  end loop;

  return v_result;
end;
$$;

grant execute on function public.replace_voucher_lines(uuid, jsonb) to authenticated;
grant execute on function public.replace_voucher_allocations(uuid, jsonb) to authenticated;
grant execute on function public.bulk_create_accounts(jsonb) to authenticated;

comment on function public.replace_voucher_lines(uuid, jsonb) is
  'يستبدل كل أسطر سند غير مرحّل في معاملة واحدة';

comment on function public.replace_voucher_allocations(uuid, jsonb) is
  'يستبدل كل تخصيصات سند غير مرحّل في معاملة واحدة';

comment on function public.bulk_create_accounts(jsonb) is
  'ينشئ دفعة حسابات ذرّياً — الأكواد تُحسب مسبقاً بالواجهة';

-- =============================================================================
-- BEGIN patch_reverse_invoice_settlement.sql
-- =============================================================================
-- =============================================================================
-- patch_reverse_invoice_settlement.sql (#29)
-- =============================================================================
-- عكس سندات إغلاق الحركات/الفواتير: سند عكسي + إلغاء الأصلي لإعادة فتح التخصيصات.
-- يُصلح أيضاً دالة الترحيل (فترة محاسبية + مقاصة CC/فرع + cc_optional + حد التخصيص).
-- =============================================================================

create or replace function public.is_force_voucher_reverse()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.force_voucher_reverse', true), '') = 'on';
$$;

create or replace function public.vouchers_validate_parties()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if TG_OP = 'UPDATE' and new.status = 'posted' and old.status = 'posted' then
    if not public.is_admin()
      and not public.is_force_voucher_delete()
      and not public.is_force_voucher_reverse() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;
  end if;

  if new.customer_id is not null then
    select is_active into v_customer_active from public.customers where id = new.customer_id;
    if not coalesce(v_customer_active, false) then
      raise exception 'Referenced customer must be active.';
    end if;
  end if;

  if new.vendor_id is not null then
    select is_active into v_vendor_active from public.vendors where id = new.vendor_id;
    if not coalesce(v_vendor_active, false) then
      raise exception 'Referenced vendor must be active.';
    end if;
  end if;

  if new.settlement_mode = 'invoice' then
    if new.voucher_type not in ('receipt', 'payment') then
      raise exception 'Invoice settlement mode is allowed only for receipt/payment vouchers.';
    end if;

    if new.customer_id is null and new.vendor_id is null then
      raise exception 'Invoice settlement voucher requires a customer or vendor reference.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ترحيل السند — نسخة موحّدة (فترة + مقاصة + cc_optional + حد التخصيص + اعتماد)
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
  v_netting record;
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() or public.is_force_voucher_reverse() then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        branch_id = new.branch_id,
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

    perform public.assert_accounting_period_open(new.voucher_date, new.branch_id);

    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;

      perform public.validate_voucher_allocations_capacity(new.id, true);
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and not coalesce(vl.cc_optional, false)
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id,
      branch_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id,
      new.branch_id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      branch_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.branch_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    for v_netting in
      select *
      from public.voucher_netting_lines vnl
      where vnl.voucher_id = new.id
        and vnl.amount > 0
    loop
      if v_netting.inter_account_id is null then
        raise exception 'Netting line requires inter_account_id.';
      end if;

      if v_netting.netting_kind = 'cc' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة CC — مدين'),
          v_netting.to_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة CC — دائن'),
          v_netting.from_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      elsif v_netting.netting_kind = 'branch' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة فرع — مدين'),
          null,
          v_netting.to_branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة فرع — دائن'),
          null,
          v_netting.from_branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      end if;
    end loop;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

create or replace function public.reverse_posted_voucher(p_voucher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.vouchers%rowtype;
  v_new_id uuid;
  v_new_no varchar(40);
  v_suffix text;
  v_reversal_mode varchar(20);
begin
  if not public.has_permission('vouchers.edit') then
    raise exception 'Permission denied: vouchers.edit required.';
  end if;

  select * into v_src from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_src.status = 'cancelled' then
    raise exception 'Voucher is already cancelled.';
  end if;

  if v_src.status <> 'posted' then
    raise exception 'Only posted vouchers can be reversed.';
  end if;

  if v_src.voucher_no like 'RV-%' then
    raise exception 'Cannot reverse a reversal voucher.';
  end if;

  v_reversal_mode := case
    when v_src.settlement_mode = 'invoice' then 'account'
    else v_src.settlement_mode
  end;

  v_suffix := right(
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    6
  );
  v_new_no := 'RV-' || v_src.voucher_no || '-' || v_suffix;
  if length(v_new_no) > 40 then
    v_new_no := left(v_new_no, 40);
  end if;

  perform set_config('app.force_voucher_reverse', 'on', true);

  insert into public.vouchers (
    voucher_no,
    voucher_type,
    settlement_mode,
    voucher_date,
    description,
    status,
    customer_id,
    vendor_id,
    currency_id,
    exchange_rate,
    cost_center_id,
    branch_id
  )
  values (
    v_new_no,
    v_src.voucher_type,
    v_reversal_mode,
    current_date,
    'عكس السند ' || v_src.voucher_no,
    'approved',
    v_src.customer_id,
    v_src.vendor_id,
    v_src.currency_id,
    v_src.exchange_rate,
    v_src.cost_center_id,
    v_src.branch_id
  )
  returning id into v_new_id;

  insert into public.voucher_lines (
    voucher_id,
    account_id,
    side,
    amount,
    line_description,
    cost_center_id,
    line_category_id,
    category_quantity,
    cc_optional
  )
  select
    v_new_id,
    vl.account_id,
    case when vl.side = 'debit' then 'credit' else 'debit' end,
    vl.amount,
    coalesce('عكس: ' || nullif(trim(vl.line_description), ''), 'عكس سطر'),
    vl.cost_center_id,
    vl.line_category_id,
    vl.category_quantity,
    vl.cc_optional
  from public.voucher_lines vl
  where vl.voucher_id = p_voucher_id;

  insert into public.voucher_netting_lines (
    voucher_id,
    netting_kind,
    from_cc_id,
    to_cc_id,
    from_branch_id,
    to_branch_id,
    amount,
    currency_id,
    includes_cash,
    inter_account_id,
    note
  )
  select
    v_new_id,
    vnl.netting_kind,
    vnl.to_cc_id,
    vnl.from_cc_id,
    vnl.to_branch_id,
    vnl.from_branch_id,
    vnl.amount,
    vnl.currency_id,
    vnl.includes_cash,
    vnl.inter_account_id,
    coalesce('عكس: ' || nullif(trim(vnl.note), ''), vnl.note)
  from public.voucher_netting_lines vnl
  where vnl.voucher_id = p_voucher_id
    and vnl.amount > 0;

  update public.vouchers
  set status = 'posted', updated_at = now()
  where id = v_new_id;

  update public.vouchers
  set
    status = 'cancelled',
    description = trim(both from coalesce(description, '') || ' — مُعكوس بـ ' || v_new_no),
    updated_at = now()
  where id = p_voucher_id;

  perform set_config('app.force_voucher_reverse', 'off', true);

  return v_new_id;
exception
  when others then
    perform set_config('app.force_voucher_reverse', 'off', true);
    raise;
end;
$$;

grant execute on function public.reverse_posted_voucher(uuid) to authenticated;

comment on function public.reverse_posted_voucher(uuid) is
  'عكس سند مرحّل: سند عكسي مرحّل + إلغاء الأصلي (يُعيد فتح التخصيصات لسندات invoice)';

-- =============================================================================
-- BEGIN patch_audit_remaining.sql
-- =============================================================================
-- =============================================================================
-- patch_audit_remaining.sql (#30)
-- =============================================================================
-- بنود AUDIT_REMAINING.md المنخفضة: دوران تصنيفات المواد + قفل فرع المستودع.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تصنيفات المواد — منع التسلسل الدائري (مثل دليل الحسابات)
-- ---------------------------------------------------------------------------

create or replace function public.material_categories_apply_hierarchy_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Material category cannot be parent of itself.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants as (
          select id, parent_id
          from public.material_categories
          where parent_id = old.id
          union all
          select c.id, c.parent_id
          from public.material_categories c
          inner join descendants d on c.parent_id = d.id
        )
        select 1
        from descendants
        where id = new.parent_id
      ) then
        raise exception 'Circular material category hierarchy is not allowed.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_material_categories_hierarchy on public.material_categories;
create trigger trg_material_categories_hierarchy
before insert or update on public.material_categories
for each row execute function public.material_categories_apply_hierarchy_rules();

-- ---------------------------------------------------------------------------
-- المستودعات — منع تغيير الفرع بعد حركات مخزنية
-- ---------------------------------------------------------------------------

create or replace function public.warehouses_prevent_branch_change_with_movements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.branch_id is distinct from new.branch_id then
    if exists (
      select 1
      from public.inventory_movements im
      where im.warehouse_id = old.id
      limit 1
    ) then
      raise exception
        'Cannot change warehouse branch after inventory movements exist.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_warehouses_prevent_branch_change on public.warehouses;
create trigger trg_warehouses_prevent_branch_change
before update on public.warehouses
for each row execute function public.warehouses_prevent_branch_change_with_movements();

comment on function public.material_categories_apply_hierarchy_rules() is
  'يمنع التصنيف من أن يكون أباً لأحد أسلافه';

comment on function public.warehouses_prevent_branch_change_with_movements() is
  'يمنع نقل المستودع لفرع آخر بعد تسجيل حركات مخزنية';

-- =============================================================================
-- BEGIN patch_materials_item_card.sql
-- =============================================================================
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

-- =============================================================================
-- BEGIN patch_materials_tracking.sql
-- =============================================================================
-- =============================================================================
-- patch_materials_tracking.sql (#32)
-- =============================================================================
-- تتبع المادة: صلاحية + رقم تسلسلي + إجبار عند الإدخال/الإخراج.
-- =============================================================================

alter table public.materials
  add column if not exists has_expiry_date boolean not null default false,
  add column if not exists expiry_days int null
    check (expiry_days is null or expiry_days > 0),
  add column if not exists require_expiry_on_inbound boolean not null default false,
  add column if not exists require_expiry_on_outbound boolean not null default false,
  add column if not exists has_serial_number boolean not null default false,
  add column if not exists require_serial_on_inbound boolean not null default false,
  add column if not exists require_serial_on_outbound boolean not null default false;

comment on column public.materials.has_expiry_date is 'يوجد تاريخ صلاحية للمادة';
comment on column public.materials.expiry_days is 'مدة الصلاحية بالأيام — اختياري';
comment on column public.materials.require_expiry_on_inbound is 'إجبار تاريخ الصلاحية عند الإدخال';
comment on column public.materials.require_expiry_on_outbound is 'إجبار تاريخ الصلاحية عند الإخراج';
comment on column public.materials.has_serial_number is 'تتبع برقم تسلسلي';
comment on column public.materials.require_serial_on_inbound is 'إجبار الرقم التسلسلي عند الإدخال';
comment on column public.materials.require_serial_on_outbound is 'إجبار الرقم التسلسلي عند الإخراج';

alter table public.invoice_material_lines
  add column if not exists expiry_date date null,
  add column if not exists serial_number varchar(100) null;

comment on column public.invoice_material_lines.expiry_date is 'تاريخ صلاحية السطر';
comment on column public.invoice_material_lines.serial_number is 'رقم تسلسلي للسطر';

alter table public.inventory_movements
  add column if not exists expiry_date date null,
  add column if not exists serial_number varchar(100) null;

comment on column public.inventory_movements.expiry_date is 'تاريخ صلاحية الحركة';
comment on column public.inventory_movements.serial_number is 'رقم تسلسلي للحركة';

-- ---------------------------------------------------------------------------
-- مساعدات الاتجاه (إدخال / إخراج)
-- ---------------------------------------------------------------------------

create or replace function public.is_inbound_commercial_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'purchase', 'return_sale', 'opening_stock', 'transfer_in'
  );
$$;

create or replace function public.is_outbound_commercial_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'sale', 'return_purchase', 'transfer_out'
  );
$$;

-- ---------------------------------------------------------------------------
-- التحقق من إجبار الصلاحية والرقم التسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.assert_material_line_tracking(
  p_material_id uuid,
  p_commercial_kind varchar,
  p_expiry_date date,
  p_serial_number text
)
returns void
language plpgsql
as $$
declare
  v_mat public.materials%rowtype;
  v_serial text;
begin
  select * into v_mat
  from public.materials
  where id = p_material_id;

  if not found then
    raise exception 'Material not found.';
  end if;

  v_serial := nullif(trim(coalesce(p_serial_number, '')), '');

  if public.is_inbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_inbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_inbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  elsif public.is_outbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_outbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_outbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  end if;
end;
$$;

comment on function public.assert_material_line_tracking is
  'يتحقق من إجبار تاريخ الصلاحية/الرقم التسلسلي حسب إعدادات المادة ونوع الحركة.';

-- ---------------------------------------------------------------------------
-- محفز أسطر الفواتير
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_validate_tracking()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_status varchar(20);
begin
  select ip.commercial_kind, i.status
  into v_kind, v_status
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where i.id = new.invoice_id;

  if v_status = 'posted' then
    raise exception 'Cannot modify material lines on a posted invoice.';
  end if;

  perform public.assert_material_line_tracking(
    new.material_id,
    v_kind,
    new.expiry_date,
    new.serial_number
  );

  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_validate_tracking
  on public.invoice_material_lines;

create trigger trg_invoice_material_lines_validate_tracking
  before insert or update on public.invoice_material_lines
  for each row
  execute function public.invoice_material_lines_validate_tracking();

-- ---------------------------------------------------------------------------
-- نسخ التتبع من سطر الفاتورة إلى حركة المخزون عند الترحيل
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_fill_tracking()
returns trigger
language plpgsql
as $$
begin
  if new.source_type = 'invoice' and new.source_line_id is not null then
    select iml.expiry_date, iml.serial_number
    into new.expiry_date, new.serial_number
    from public.invoice_material_lines iml
    where iml.id = new.source_line_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_movements_fill_tracking
  on public.inventory_movements;

create trigger trg_inventory_movements_fill_tracking
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_fill_tracking();

-- =============================================================================
-- BEGIN patch_invoice_line_adjustments.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_line_adjustments.sql (#33)
-- =============================================================================
-- خصم وإضافي per سطر (نسبة أو مبلغ) + تأثير على كلفة المواد حسب النمط.
-- =============================================================================

alter table public.invoice_patterns
  add column if not exists line_extra_enabled boolean not null default false,
  add column if not exists line_adjustments_affect_material_cost boolean not null default true;

comment on column public.invoice_patterns.line_extra_enabled is
  'إظهار حقول الإضافي على أسطر المواد';
comment on column public.invoice_patterns.line_adjustments_affect_material_cost is
  'عند true: صافي السطر (خصم/إضافي) يؤثر على تكلفة المخزون للفواتير الإدخالية';

alter table public.invoice_material_lines
  add column if not exists extra_percent numeric(5, 2) null
    check (extra_percent is null or (extra_percent >= 0 and extra_percent <= 100)),
  add column if not exists extra_amount numeric(18, 2) not null default 0
    check (extra_amount >= 0);

comment on column public.invoice_material_lines.extra_percent is 'إضافي السطر — نسبة من الإجمالي';
comment on column public.invoice_material_lines.extra_amount is 'إضافي السطر — مبلغ ثابت';

-- ---------------------------------------------------------------------------
-- أنواع الفواتير التي قد تُحدّث تكلفة المخزون من صافي السطر
-- ---------------------------------------------------------------------------

create or replace function public.invoice_kind_affects_material_line_cost(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('purchase', 'opening_stock', 'return_sale');
$$;

-- ---------------------------------------------------------------------------
-- محفز أسطر المواد — صافي = إجمالي − خصم + إضافي
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_apply_quantities()
returns trigger
language plpgsql
as $$
declare
  v_gross numeric(18, 4);
  v_discount numeric(18, 2);
  v_extra numeric(18, 2);
begin
  if not exists (
    select 1 from public.material_units mu
    where mu.id = new.material_unit_id
      and mu.material_id = new.material_id
  ) then
    raise exception 'material_unit_id does not belong to material_id.';
  end if;

  new.quantity_base := public.material_quantity_to_base(new.material_unit_id, new.quantity);
  v_gross := new.quantity * new.unit_price;

  if new.discount_percent is not null and new.discount_percent > 0 then
    v_discount := round((v_gross * new.discount_percent / 100)::numeric, 2);
    new.discount_amount := v_discount;
  else
    v_discount := coalesce(new.discount_amount, 0);
    if v_discount > v_gross then
      raise exception 'discount_amount cannot exceed line gross amount.';
    end if;
  end if;

  if new.extra_percent is not null and new.extra_percent > 0 then
    v_extra := round((v_gross * new.extra_percent / 100)::numeric, 2);
    new.extra_amount := v_extra;
  else
    v_extra := coalesce(new.extra_amount, 0);
  end if;

  new.line_amount := round((v_gross - v_discount + v_extra)::numeric, 2);

  if new.line_amount < 0 then
    raise exception 'Line net amount cannot be negative after discount/extra.';
  end if;

  if exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id
      and w.branch_id <> new.branch_id
  ) then
    raise exception 'warehouse branch must match line branch_id.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- تكلفة المخزون من صافي السطر عند الترحيل
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_apply_invoice_line_cost()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_affect boolean;
  v_line_amount numeric(18, 2);
  v_qty_base numeric(18, 6);
begin
  if new.source_type <> 'invoice' or new.source_line_id is null then
    return new;
  end if;

  select ip.commercial_kind, coalesce(ip.line_adjustments_affect_material_cost, true), iml.line_amount, iml.quantity_base
  into v_kind, v_affect, v_line_amount, v_qty_base
  from public.invoice_material_lines iml
  inner join public.invoices i on i.id = iml.invoice_id
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where iml.id = new.source_line_id;

  if not found then
    return new;
  end if;

  if not public.invoice_kind_affects_material_line_cost(v_kind) or not v_affect then
    return new;
  end if;

  new.total_cost := v_line_amount;
  if v_qty_base > 0 then
    new.unit_cost := round((v_line_amount / v_qty_base)::numeric, 4);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_movements_apply_invoice_line_cost
  on public.inventory_movements;

create trigger trg_inventory_movements_apply_invoice_line_cost
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_apply_invoice_line_cost();


-- ---------------------------------------------------------------------------
-- post_invoice — خصم/إضافي سطر
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_inv_settings public.company_inventory_settings%rowtype;
  v_je_id uuid;
  v_entry_no varchar(40);
  v_rate numeric(18, 6);
  v_creditor uuid;
  v_debtor uuid;
  v_cost uuid;
  v_inventory uuid;
  v_transit uuid;
  v_material_total numeric(18, 2) := 0;
  v_account_debit numeric(18, 2) := 0;
  v_account_credit numeric(18, 2) := 0;
  v_je_debit numeric(18, 2);
  v_je_credit numeric(18, 2);
  v_party_type varchar(20);
  v_party_id uuid;
  v_row record;
  v_line_cost numeric(18, 2);
  v_has_materials boolean;
  v_discount_acct uuid;
  v_extra_acct uuid;
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_line_extra numeric(18, 2);
  v_round_step numeric(18, 4);
  v_party_total numeric(18, 2);
  v_rounded_total numeric(18, 2);
  v_rounding_diff numeric(18, 2);
begin
  perform set_config('app.invoice_posting', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status = 'posted' then
    raise exception 'Invoice is already posted.';
  end if;

  if v_inv.status = 'cancelled' then
    raise exception 'Cannot post cancelled invoice.';
  end if;

  perform public.assert_accounting_period_open(v_inv.invoice_date, v_inv.branch_id);

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;
  select * into v_inv_settings from public.company_inventory_settings where id = 1;

  v_creditor := coalesce(v_inv.creditor_account_id, v_pat.default_creditor_account_id);
  v_debtor := coalesce(v_inv.debtor_account_id, v_pat.default_debtor_account_id);
  v_cost := coalesce(v_inv.cost_account_id, v_pat.default_cost_account_id);
  v_inventory := coalesce(v_inv.inventory_account_id, v_pat.default_inventory_account_id);
  v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id);
  v_rate := coalesce(nullif(v_inv.exchange_rate, 0), 1);

  select coalesce(sum(iml.line_amount), 0)
  into v_material_total
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id;

  select
    coalesce(sum(case when ial.side = 'debit' then ial.amount else 0 end), 0),
    coalesce(sum(case when ial.side = 'credit' then ial.amount else 0 end), 0)
  into v_account_debit, v_account_credit
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id;

  v_has_materials := exists (
    select 1 from public.invoice_material_lines iml where iml.invoice_id = p_invoice_id
  );

  if v_has_materials and v_inv_settings.inventory_method is null then
    raise exception 'Configure inventory_method in company_inventory_settings before posting.';
  end if;

  if not v_has_materials and v_account_debit = 0 and v_account_credit = 0 then
    raise exception 'Cannot post empty invoice.';
  end if;

  if v_inv.customer_id is not null then
    v_party_type := 'customer';
    v_party_id := v_inv.customer_id;
  elsif v_inv.vendor_id is not null then
    v_party_type := 'vendor';
    v_party_id := v_inv.vendor_id;
  else
    v_party_type := null;
    v_party_id := null;
  end if;

  v_entry_no := 'JE-' || v_inv.invoice_no;

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    v_inv.invoice_date,
    coalesce(v_inv.description, 'مرحّل من فاتورة ' || v_inv.invoice_no),
    'posted',
    'invoice',
    p_invoice_id,
    v_inv.branch_id
  )
  returning id into v_je_id;

  -- أسطر الحسابات الإضافية
  for v_row in
    select * from public.invoice_account_lines ial
    where ial.invoice_id = p_invoice_id
    order by ial.line_no
  loop
    perform public._invoice_add_journal_line(
      v_je_id,
      v_row.account_id,
      case when v_row.side = 'debit' then v_row.amount else 0 end,
      case when v_row.side = 'credit' then v_row.amount else 0 end,
      coalesce(v_row.description, 'حساب إضافي — فاتورة ' || v_inv.invoice_no),
      v_row.cost_center_id,
      v_row.branch_id,
      v_inv.currency_id,
      v_rate,
      null, null, null, null,
      p_invoice_id,
      v_row.id
    );
  end loop;

  v_discount_acct := coalesce(v_inv.discount_account_id, v_pat.default_discount_account_id);
  v_extra_acct := coalesce(v_inv.extra_account_id, v_pat.default_extra_account_id);

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0 and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      if v_line_disc > 0 or v_line_extra > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        if v_line_disc > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_discount_acct, v_line_disc, 0,
            'خصم سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        if v_line_extra > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_extra_acct, 0, v_line_extra,
            'إضافي سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );

        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
        if v_line_cost > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_cost, v_line_cost, 0,
            'تكلفة مبيعات', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
          perform public._invoice_add_journal_line(
            v_je_id, v_inventory, 0, v_line_cost,
            'مخزون', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
        end if;
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'purchase' then
    if v_creditor is null then
      raise exception 'Purchase invoice requires creditor account (payable/cash).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory,
          case
            when coalesce(v_pat.line_adjustments_affect_material_cost, true) then v_row.line_amount
            else v_line_gross - v_line_disc
          end,
          0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor,
          case
            when coalesce(v_pat.line_adjustments_affect_material_cost, true) then v_row.line_amount
            else v_line_gross - v_line_disc
          end,
          0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_disc > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_extra > 0 and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_extra_acct, v_line_extra, 0,
          'إضافي سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, 0, v_row.line_amount,
        case when v_inv.settlement_mode = 'credit' then 'ذمم مورد' else 'نقدي' end,
        coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
        p_invoice_id, v_row.id
      );

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'transfer_out' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Transfer out (perpetual) requires inventory account.';
        end if;
        if v_transit is null then
          raise exception 'Transfer out (perpetual) requires transit account on pattern/invoice.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, v_line_cost, 0,
          'بضاعة بالطريق — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون مصدر — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_out', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set status = 'dispatched', shipped_at = coalesce(shipped_at, now()), out_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'transfer_in' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null or v_transit is null then
          raise exception 'Transfer in (perpetual) requires inventory and transit accounts.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون هدف — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, 0, v_line_cost,
          'إغلاق بالطريق — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        coalesce(v_row.qty_received, v_row.quantity),
        v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_in', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set
        status = case
          when exists (
            select 1 from public.inventory_transfer_lines itl
            where itl.transfer_id = v_inv.inventory_transfer_id
              and itl.qty_received < itl.qty_shipped
              and itl.qty_shipped > 0
          ) then 'partially_received'
          else 'received'
        end,
        received_at = coalesce(received_at, now()),
        in_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'return_sale' then
    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_row.line_amount, 0,
        'مرتجع مبيعات', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_row.line_amount,
        'ذمم عميل — مرتجع', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
        p_invoice_id, v_row.id
      );

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := round((v_row.quantity_base * v_row.purchase_price)::numeric, 2);
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_cost, 0, v_line_cost,
          'تكلفة — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'return_sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'return_purchase' then
    if v_creditor is null then
      raise exception 'Return purchase requires creditor account (payable).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Return purchase (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_row.line_amount,
          'مخزون — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Return purchase (periodic) requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, 0, v_row.line_amount,
          'مشتريات — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'return_purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'opening_stock' then
    if v_creditor is null then
      raise exception 'Opening stock requires creditor account (opening equity / counterpart).';
    end if;

    for v_row in
      select iml.*, m.purchase_price
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_row.line_amount, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'opening_stock', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  else
    raise exception 'Unsupported commercial_kind: %', v_pat.commercial_kind;
  end case;

  -- خصم الفاتورة + تدوير الإجمالي (§9 / §التخفيض)
  if coalesce(v_inv.invoice_discount_percent, 0) > 0 then
    v_invoice_disc := round((v_material_total * v_inv.invoice_discount_percent / 100)::numeric, 2);
  elsif coalesce(v_inv.invoice_discount_amount, 0) > 0 then
    v_invoice_disc := v_inv.invoice_discount_amount;
  end if;

  if v_invoice_disc > 0 then
    if v_discount_acct is null then
      raise exception 'Invoice discount requires discount_account_id on invoice or pattern.';
    end if;
    case v_pat.commercial_kind
    when 'sale' then
      if v_debtor is null then
        raise exception 'Sale discount requires debtor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, v_invoice_disc, 0,
        'خصم فاتورة — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_invoice_disc,
        'تخفيض ذمم — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
    when 'purchase' then
      if v_creditor is null then
        raise exception 'Purchase discount requires creditor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_invoice_disc, 0,
        'خصم مشتريات — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, 0, v_invoice_disc,
        'خصم مكتسب — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
    else
      null;
    end case;
  end if;

  if v_pat.rounding_enabled
     and coalesce(v_pat.rounding_target, 'invoice_total') in ('invoice_total', 'both')
     and v_pat.commercial_kind in ('sale', 'purchase') then
    v_round_step := coalesce(nullif(v_pat.rounding_step, 0), 1);
    v_party_total := v_material_total - v_invoice_disc;
    v_rounded_total := case coalesce(v_pat.rounding_mode, 'nearest')
      when 'up' then ceil(v_party_total / v_round_step - 0.0000001) * v_round_step
      when 'down' then floor(v_party_total / v_round_step + 0.0000001) * v_round_step
      else round(v_party_total / v_round_step) * v_round_step
    end;
    v_rounding_diff := round((v_rounded_total - v_party_total)::numeric, 2);

    if v_rounding_diff <> 0 then
      case v_pat.commercial_kind
      when 'sale' then
        if v_debtor is null then
          raise exception 'Sale rounding requires debtor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, v_rounding_diff, 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, 0, abs(v_rounding_diff),
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      when 'purchase' then
        if v_creditor is null then
          raise exception 'Purchase rounding requires creditor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, 0, v_rounding_diff,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, abs(v_rounding_diff), 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      else
        null;
      end case;
    end if;
  end if;

  -- توازن القيد
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_je_debit, v_je_credit
  from public.journal_entry_lines
  where journal_entry_id = v_je_id;

  if v_je_debit <> v_je_credit then
    raise exception 'Posted invoice journal is unbalanced: debit (%) <> credit (%).', v_je_debit, v_je_credit;
  end if;

  if v_has_materials then
    perform public.lock_company_inventory_foundation(v_inv.invoice_date::timestamptz);
  end if;

  update public.invoices
  set status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  where id = p_invoice_id;

  perform set_config('app.invoice_posting', 'false', true);

  return v_je_id;
exception
  when others then
    perform set_config('app.invoice_posting', 'false', true);
    raise;
end;
$$;

grant execute on function public.post_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- حماية الفاتورة المرحّلة
-- ---------------------------------------------------------------------------

create or replace function public.invoices_before_update_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    if not public.is_admin() then
      raise exception 'Posted invoice cannot be modified.';
    end if;
    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if not public.is_invoice_posting() then
      raise exception 'Use post_invoice(invoice_id) to post invoices.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_before_update_guard on public.invoices;
create trigger trg_invoices_before_update_guard
before update on public.invoices
for each row execute function public.invoices_before_update_guard();

create or replace function public.invoice_lines_prevent_change_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_status varchar(20);
begin
  select i.status into v_status
  from public.invoices i
  where i.id = coalesce(new.invoice_id, old.invoice_id);

  if v_status = 'posted' and not public.is_admin() then
    raise exception 'Cannot modify lines of a posted invoice.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_posted_guard on public.invoice_material_lines;
create trigger trg_invoice_material_lines_posted_guard
before insert or update or delete on public.invoice_material_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();

drop trigger if exists trg_invoice_account_lines_posted_guard on public.invoice_account_lines;
create trigger trg_invoice_account_lines_posted_guard
before insert or update or delete on public.invoice_account_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();
-- =============================================================================
-- BEGIN patch_expiry_from_invoice.sql
-- =============================================================================
-- =============================================================================
-- patch_expiry_from_invoice.sql (#34)
-- =============================================================================
-- تاريخ انتهاء الصلاحية يُدخل في سطر الفاتورة فقط (وليس حساباً بعدد أيام).
-- إعدادات التتبع والإجبار تبقى في بطاقة المادة (has_expiry_date، require_*).
-- =============================================================================

-- إزالة أعمدة نمط الفاتورة إن وُجدت من نسخة سابقة خاطئة
alter table public.invoice_patterns
  drop column if exists track_expiry_date,
  drop column if exists require_expiry_date;

-- ---------------------------------------------------------------------------
-- التحقق من إجبار الصلاحية والرقم التسلسلي — من بطاقة المادة
-- ---------------------------------------------------------------------------

create or replace function public.assert_material_line_tracking(
  p_material_id uuid,
  p_commercial_kind varchar,
  p_expiry_date date,
  p_serial_number text
)
returns void
language plpgsql
as $$
declare
  v_mat public.materials%rowtype;
  v_serial text;
begin
  select * into v_mat
  from public.materials
  where id = p_material_id;

  if not found then
    raise exception 'Material not found.';
  end if;

  v_serial := nullif(trim(coalesce(p_serial_number, '')), '');

  if public.is_inbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_inbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_inbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  elsif public.is_outbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_outbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_outbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  end if;
end;
$$;

comment on function public.assert_material_line_tracking is
  'يتحقق من إجبار تاريخ الصلاحية/الرقم التسلسلي حسب إعدادات المادة ونوع الحركة.';

-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_validate_tracking()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_status varchar(20);
begin
  select ip.commercial_kind, i.status
  into v_kind, v_status
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where i.id = new.invoice_id;

  if v_status = 'posted' then
    raise exception 'Cannot modify material lines on a posted invoice.';
  end if;

  perform public.assert_material_line_tracking(
    new.material_id,
    v_kind,
    new.expiry_date,
    new.serial_number
  );

  return new;
end;
$$;

-- =============================================================================
-- BEGIN patch_invoice_pattern_tracking.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_pattern_tracking.sql (#35)
-- =============================================================================
-- خيارات نمط الفاتورة: إظهار تاريخ الصلاحية والرقم التسلسلي على الأسطر.
-- الإجبار يبقى من بطاقة المادة؛ القيم تُدخل في سطر الفاتورة.
-- =============================================================================

alter table public.invoice_patterns
  add column if not exists track_expiry_on_lines boolean not null default true,
  add column if not exists track_serial_on_lines boolean not null default true;

comment on column public.invoice_patterns.track_expiry_on_lines is
  'إظهار عمود تاريخ انتهاء الصلاحية على أسطر المواد (عند تتبع المادة)';
comment on column public.invoice_patterns.track_serial_on_lines is
  'إظهار عمود الرقم التسلسلي على أسطر المواد (عند تتبع المادة)';

-- =============================================================================
-- BEGIN patch_outbound_stock_check.sql
-- =============================================================================
-- =============================================================================
-- patch_outbound_stock_check.sql (#36)
-- =============================================================================
-- المرحلة 1: منع ترحيل فواتير الإخراج إذا الكمية تتجاوز الرصيد المتاح
-- (مادة + مستودع). يُتحكم به من النمط: enforce_stock_availability.
-- =============================================================================

alter table public.invoice_patterns
  add column if not exists enforce_stock_availability boolean not null default true;

comment on column public.invoice_patterns.enforce_stock_availability is
  'عند true: فواتير الإخراج لا تُرحَّل إذا الكمية تتجاوز رصيد المادة في المستودع';

-- ---------------------------------------------------------------------------
-- رصيد كمية أساس per مادة/مستودع حتى تاريخ معيّن
-- ---------------------------------------------------------------------------

create or replace function public.get_material_warehouse_qty_balance(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_as_of_date date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(im.quantity_base_delta), 0)::numeric(18, 6)
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id
    and im.movement_date <= coalesce(p_as_of_date, current_date);
$$;

comment on function public.get_material_warehouse_qty_balance is
  'رصيد الكمية الأساسية لمادة في مستودع حتى تاريخ معيّن';

grant execute on function public.get_material_warehouse_qty_balance(uuid, uuid, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز: منع حركات الإخراج التي تتجاوز الرصيد
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_enforce_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(18, 6);
  v_enforce boolean := true;
  v_material_code varchar;
  v_warehouse_code varchar;
begin
  if new.quantity_base_delta >= 0 then
    return new;
  end if;

  if new.movement_kind not in ('sale', 'transfer_out', 'return_purchase') then
    return new;
  end if;

  if new.source_type = 'invoice' and new.source_id is not null then
    select coalesce(ip.enforce_stock_availability, true)
    into v_enforce
    from public.invoices i
    inner join public.invoice_patterns ip on ip.id = i.pattern_id
    where i.id = new.source_id;

    if not coalesce(v_enforce, true) then
      return new;
    end if;
  end if;

  v_balance := public.get_material_warehouse_qty_balance(
    new.material_id,
    new.warehouse_id,
    new.movement_date
  );

  if v_balance + new.quantity_base_delta < -0.000001 then
    select m.material_code into v_material_code
    from public.materials m where m.id = new.material_id;

    select w.warehouse_code into v_warehouse_code
    from public.warehouses w where w.id = new.warehouse_id;

    raise exception
      'Insufficient stock for material % in warehouse %. Available: %, requested: %.',
      coalesce(v_material_code, new.material_id::text),
      coalesce(v_warehouse_code, new.warehouse_id::text),
      v_balance,
      abs(new.quantity_base_delta);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_movements_enforce_stock
  on public.inventory_movements;

create trigger trg_inventory_movements_enforce_stock
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_enforce_stock();

-- =============================================================================
-- BEGIN patch_outbound_lot_stock.sql
-- =============================================================================
-- =============================================================================
-- patch_outbound_lot_stock.sql (#37)
-- =============================================================================
-- المرحلة 2+3: رصيد per دفعة (تاريخ صلاحية / رقم تسلسلي) لفواتير الإخراج.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- رصيد دفعة: مادة + مستودع + صلاحية + تسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.get_inventory_lot_balance(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(im.quantity_base_delta), 0)::numeric(18, 6)
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id
    and im.movement_date <= coalesce(p_as_of_date, current_date)
    and im.expiry_date is not distinct from p_expiry_date
    and nullif(trim(coalesce(im.serial_number, '')), '')
      is not distinct from nullif(trim(coalesce(p_serial_number, '')), '');
$$;

comment on function public.get_inventory_lot_balance is
  'رصيد دفعة مخزون per مادة/مستودع/صلاحية/تسلسلي';

grant execute on function public.get_inventory_lot_balance(uuid, uuid, date, text, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- قائمة الدفعات المتاحة (رصيد > 0)
-- ---------------------------------------------------------------------------

drop function if exists public.list_inventory_lot_balances(uuid, uuid, date);

create or replace function public.list_inventory_lot_balances(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_as_of_date date default current_date
)
returns table (
  expiry_date date,
  serial_number varchar,
  quantity_base numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    im.expiry_date,
    nullif(trim(im.serial_number), '')::varchar as serial_number,
    sum(im.quantity_base_delta)::numeric(18, 6) as quantity_base
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id
    and im.movement_date <= coalesce(p_as_of_date, current_date)
  group by im.expiry_date, nullif(trim(im.serial_number), '')
  having sum(im.quantity_base_delta) > 0.000001
  order by im.expiry_date nulls last, nullif(trim(im.serial_number), '');
$$;

comment on function public.list_inventory_lot_balances is
  'دفعات مخزون متاحة per مادة/مستودع';

grant execute on function public.list_inventory_lot_balances(uuid, uuid, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز الإخراج — رصيد إجمالي + دفعة صلاحية/تسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_enforce_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(18, 6);
  v_lot_balance numeric(18, 6);
  v_enforce boolean := true;
  v_material_code varchar;
  v_warehouse_code varchar;
  v_has_expiry boolean;
  v_has_serial boolean;
  v_serial text;
begin
  if new.quantity_base_delta >= 0 then
    return new;
  end if;

  if new.movement_kind not in ('sale', 'transfer_out', 'return_purchase') then
    return new;
  end if;

  if new.source_type = 'invoice' and new.source_id is not null then
    select coalesce(ip.enforce_stock_availability, true)
    into v_enforce
    from public.invoices i
    inner join public.invoice_patterns ip on ip.id = i.pattern_id
    where i.id = new.source_id;

    if not coalesce(v_enforce, true) then
      return new;
    end if;
  end if;

  select m.material_code, m.has_expiry_date, m.has_serial_number
  into v_material_code, v_has_expiry, v_has_serial
  from public.materials m
  where m.id = new.material_id;

  select w.warehouse_code into v_warehouse_code
  from public.warehouses w
  where w.id = new.warehouse_id;

  v_serial := nullif(trim(coalesce(new.serial_number, '')), '');

  v_balance := public.get_material_warehouse_qty_balance(
    new.material_id,
    new.warehouse_id,
    new.movement_date
  );

  if v_balance + new.quantity_base_delta < -0.000001 then
    raise exception
      'Insufficient stock for material % in warehouse %. Available: %, requested: %.',
      coalesce(v_material_code, new.material_id::text),
      coalesce(v_warehouse_code, new.warehouse_id::text),
      v_balance,
      abs(new.quantity_base_delta);
  end if;

  if (v_has_expiry and new.expiry_date is not null)
     or (v_has_serial and v_serial is not null) then
    v_lot_balance := public.get_inventory_lot_balance(
      new.material_id,
      new.warehouse_id,
      case when v_has_expiry then new.expiry_date else null end,
      case when v_has_serial then v_serial else null end,
      new.movement_date
    );

    if v_lot_balance + new.quantity_base_delta < -0.000001 then
      raise exception
        'Insufficient lot stock for material % in warehouse %. Expiry: %, serial: %, available: %, requested: %.',
        coalesce(v_material_code, new.material_id::text),
        coalesce(v_warehouse_code, new.warehouse_id::text),
        coalesce(new.expiry_date::text, '—'),
        coalesce(v_serial, '—'),
        v_lot_balance,
        abs(new.quantity_base_delta);
    end if;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- BEGIN patch_inventory_cost_dimensions.sql
-- =============================================================================
-- =============================================================================
-- patch_inventory_cost_dimensions.sql — أبعاد فصل التكلفة (صلاحية / تسلسلي)
-- =============================================================================
-- يتطلب: patch_outbound_lot_stock.sql
-- التالي: —
-- =============================================================================

alter table public.company_inventory_settings
  add column if not exists cost_per_expiry_date boolean not null default false,
  add column if not exists cost_per_serial_number boolean not null default false;

comment on column public.company_inventory_settings.cost_per_expiry_date is
  'عند true: تكلفة الوحدة تُفصل per تاريخ انتهاء الصلاحية (دفعات صلاحية)';
comment on column public.company_inventory_settings.cost_per_serial_number is
  'عند true: تكلفة الوحدة تُفصل per رقم تسلسلي (دفعات تسلسلية)';

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
    or new.cost_per_expiry_date is distinct from old.cost_per_expiry_date
    or new.cost_per_serial_number is distinct from old.cost_per_serial_number
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
    if old.foundation_locked_at is not null then
      new.foundation_locked_at := old.foundation_locked_at;
    end if;
  end if;

  return new;
end;
$$;

comment on column public.company_inventory_settings.foundation_locked is
  'عند true: لا تعديل على inventory_method, costing_method, cost_per_* (مستودع، CC، صلاحية، تسلسلي)';

-- =============================================================================
-- BEGIN patch_invoice_pricing_cost.sql
-- =============================================================================
-- =============================================================================
-- patch_invoice_pricing_cost.sql (#39)
-- =============================================================================
-- ربط pricing_cost_mode / pricing_consumed_mode / فصل التكلفة بالصلاحية والتسلسلي
-- بحركات المخزون وقيود الترحيل.
-- يتطلب: patch_inventory_cost_dimensions.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- أنواع الفواتير الإدخالية / الإخراجية
-- ---------------------------------------------------------------------------

create or replace function public.invoice_is_inbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('purchase', 'opening_stock', 'return_sale', 'transfer_in');
$$;

create or replace function public.invoice_is_outbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('sale', 'return_purchase', 'transfer_out');
$$;

create or replace function public.invoice_kind_affects_material_line_cost(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in ('purchase', 'opening_stock', 'return_sale', 'transfer_in');
$$;

-- ---------------------------------------------------------------------------
-- تكلفة الإدخال من إعدادات النمط
-- ---------------------------------------------------------------------------

create or replace function public.calc_inbound_inventory_amount(
  p_pricing_cost_mode varchar,
  p_adjustments_affect boolean,
  p_line_amount numeric,
  p_line_gross numeric,
  p_line_disc numeric
)
returns numeric
language sql
immutable
as $$
  select case coalesce(nullif(trim(p_pricing_cost_mode), ''), 'line_net')
    when 'none' then 0::numeric(18, 2)
    when 'line_gross' then round(coalesce(p_line_gross, 0)::numeric, 2)
    else round(
      case
        when coalesce(p_adjustments_affect, true) then coalesce(p_line_amount, 0)
        else coalesce(p_line_gross, 0) - coalesce(p_line_disc, 0)
      end::numeric,
      2
    )
  end;
$$;

comment on function public.calc_inbound_inventory_amount is
  'مبلغ تكلفة المخزون للسطر الإدخالي حسب pricing_cost_mode';

-- ---------------------------------------------------------------------------
-- متوسط تكلفة الوحدة مع أبعاد الفصل
-- ---------------------------------------------------------------------------

create or replace function public.get_scoped_inventory_unit_cost(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date,
  p_cost_per_cost_center boolean,
  p_filter_expiry boolean,
  p_filter_serial boolean,
  p_fallback_unit_cost numeric
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select round((
        sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
        / nullif(sum(im.quantity_base_delta), 0)
      )::numeric, 4)
      from public.inventory_movements im
      where im.material_id = p_material_id
        and im.warehouse_id = p_warehouse_id
        and im.movement_date <= coalesce(p_as_of_date, current_date)
        and (
          not coalesce(p_cost_per_cost_center, false)
          or im.cost_center_id is not distinct from p_cost_center_id
        )
        and (
          not coalesce(p_filter_expiry, false)
          or im.expiry_date is not distinct from p_expiry_date
        )
        and (
          not coalesce(p_filter_serial, false)
          or nullif(trim(coalesce(im.serial_number, '')), '')
            is not distinct from nullif(trim(coalesce(p_serial_number, '')), '')
        )
    ),
    p_fallback_unit_cost,
    0
  );
$$;

comment on function public.get_scoped_inventory_unit_cost is
  'متوسط تكلفة الوحدة مع فلترة CC / صلاحية / تسلسلي';

grant execute on function public.get_scoped_inventory_unit_cost(
  uuid, uuid, uuid, date, text, date, boolean, boolean, boolean, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- تكلفة الإخراج per سطر
-- ---------------------------------------------------------------------------

create or replace function public.calc_outbound_unit_cost(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
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
  v_mode varchar(30);
  v_filter_expiry boolean;
  v_filter_serial boolean;
begin
  v_mode := coalesce(nullif(trim(p_consumed_mode), ''), 'weighted_avg');

  if v_mode = 'line_price' then
    if coalesce(p_factor_to_base, 0) > 0 then
      return round((p_line_unit_price / p_factor_to_base)::numeric, 4);
    end if;
    return round(coalesce(p_line_unit_price, 0)::numeric, 4);
  end if;

  if v_mode = 'standard' then
    return round(coalesce(p_material_purchase_price, 0)::numeric, 4);
  end if;

  v_filter_expiry := v_mode = 'lot_cost'
    or coalesce(p_settings.cost_per_expiry_date, false);
  v_filter_serial := v_mode = 'lot_cost'
    or coalesce(p_settings.cost_per_serial_number, false);

  return public.get_scoped_inventory_unit_cost(
    p_material_id,
    p_warehouse_id,
    p_cost_center_id,
    p_expiry_date,
    p_serial_number,
    p_as_of_date,
    coalesce(p_settings.cost_per_cost_center, false),
    v_filter_expiry,
    v_filter_serial,
    p_material_purchase_price
  );
end;
$$;

create or replace function public.calc_outbound_line_total_cost(
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
language sql
stable
security definer
set search_path = public
as $$
  select round((
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
$$;

grant execute on function public.calc_outbound_unit_cost(
  varchar,
  public.company_inventory_settings,
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

-- ---------------------------------------------------------------------------
-- محفز حركة المخزون — تطبيق تكلفة السطر من إعدادات النمط
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_apply_invoice_line_cost()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_cost_mode varchar(30);
  v_consumed_mode varchar(30);
  v_affect boolean;
  v_settings public.company_inventory_settings%rowtype;
  v_line_amount numeric(18, 2);
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_qty_base numeric(18, 6);
  v_inbound_amount numeric(18, 2);
  v_unit_cost numeric(18, 4);
  v_expiry date;
  v_serial text;
  v_purchase_price numeric(18, 4);
  v_unit_price numeric(18, 4);
  v_factor numeric(18, 6);
  v_movement_date date;
begin
  if new.source_type <> 'invoice' or new.source_line_id is null then
    return new;
  end if;

  select
    ip.commercial_kind,
    ip.pricing_cost_mode,
    ip.pricing_consumed_mode,
    coalesce(ip.line_adjustments_affect_material_cost, true),
    iml.line_amount,
    round((iml.quantity * iml.unit_price)::numeric, 2),
    coalesce(iml.discount_amount, 0),
    iml.quantity_base,
    iml.expiry_date,
    iml.serial_number,
    m.purchase_price,
    iml.unit_price,
    mu.factor_to_base,
    i.invoice_date
  into
    v_kind,
    v_cost_mode,
    v_consumed_mode,
    v_affect,
    v_line_amount,
    v_line_gross,
    v_line_disc,
    v_qty_base,
    v_expiry,
    v_serial,
    v_purchase_price,
    v_unit_price,
    v_factor,
    v_movement_date
  from public.invoice_material_lines iml
  inner join public.invoices i on i.id = iml.invoice_id
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.materials m on m.id = iml.material_id
  inner join public.material_units mu on mu.id = iml.material_unit_id
  where iml.id = new.source_line_id;

  if not found then
    return new;
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;

  if new.quantity_base_delta > 0
     and public.invoice_is_inbound_kind(v_kind) then
    v_inbound_amount := public.calc_inbound_inventory_amount(
      v_cost_mode,
      v_affect,
      v_line_amount,
      v_line_gross,
      v_line_disc
    );
    new.total_cost := v_inbound_amount;
    if v_qty_base > 0 then
      new.unit_cost := round((v_inbound_amount / v_qty_base)::numeric, 4);
    else
      new.unit_cost := 0;
    end if;
    return new;
  end if;

  if new.quantity_base_delta < 0
     and public.invoice_is_outbound_kind(v_kind) then
    v_unit_cost := public.calc_outbound_unit_cost(
      v_consumed_mode,
      v_settings,
      v_purchase_price,
      v_unit_price,
      v_factor,
      new.material_id,
      new.warehouse_id,
      new.cost_center_id,
      v_expiry,
      v_serial,
      coalesce(new.movement_date, v_movement_date)
    );
    new.unit_cost := v_unit_cost;
    new.total_cost := round((abs(new.quantity_base_delta) * v_unit_cost)::numeric, 2);
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_movements_apply_invoice_line_cost
  on public.inventory_movements;

create trigger trg_inventory_movements_apply_invoice_line_cost
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_apply_invoice_line_cost();

-- ---------------------------------------------------------------------------
-- post_invoice — قيود التكلفة من إعدادات النمط
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_inv_settings public.company_inventory_settings%rowtype;
  v_je_id uuid;
  v_entry_no varchar(40);
  v_rate numeric(18, 6);
  v_creditor uuid;
  v_debtor uuid;
  v_cost uuid;
  v_inventory uuid;
  v_transit uuid;
  v_material_total numeric(18, 2) := 0;
  v_account_debit numeric(18, 2) := 0;
  v_account_credit numeric(18, 2) := 0;
  v_je_debit numeric(18, 2);
  v_je_credit numeric(18, 2);
  v_party_type varchar(20);
  v_party_id uuid;
  v_row record;
  v_line_cost numeric(18, 2);
  v_has_materials boolean;
  v_discount_acct uuid;
  v_extra_acct uuid;
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_line_extra numeric(18, 2);
  v_qty_recv numeric(18, 6);
  v_qty_base_recv numeric(18, 6);
  v_round_step numeric(18, 4);
  v_party_total numeric(18, 2);
  v_rounded_total numeric(18, 2);
  v_rounding_diff numeric(18, 2);
begin
  perform set_config('app.invoice_posting', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status = 'posted' then
    raise exception 'Invoice is already posted.';
  end if;

  if v_inv.status = 'cancelled' then
    raise exception 'Cannot post cancelled invoice.';
  end if;

  perform public.assert_accounting_period_open(v_inv.invoice_date, v_inv.branch_id);

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;
  select * into v_inv_settings from public.company_inventory_settings where id = 1;

  v_creditor := coalesce(v_inv.creditor_account_id, v_pat.default_creditor_account_id);
  v_debtor := coalesce(v_inv.debtor_account_id, v_pat.default_debtor_account_id);
  v_cost := coalesce(v_inv.cost_account_id, v_pat.default_cost_account_id);
  v_inventory := coalesce(v_inv.inventory_account_id, v_pat.default_inventory_account_id);
  v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id);
  v_rate := coalesce(nullif(v_inv.exchange_rate, 0), 1);

  select coalesce(sum(iml.line_amount), 0)
  into v_material_total
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id;

  select
    coalesce(sum(case when ial.side = 'debit' then ial.amount else 0 end), 0),
    coalesce(sum(case when ial.side = 'credit' then ial.amount else 0 end), 0)
  into v_account_debit, v_account_credit
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id;

  v_has_materials := exists (
    select 1 from public.invoice_material_lines iml where iml.invoice_id = p_invoice_id
  );

  if v_has_materials and v_inv_settings.inventory_method is null then
    raise exception 'Configure inventory_method in company_inventory_settings before posting.';
  end if;

  if not v_has_materials and v_account_debit = 0 and v_account_credit = 0 then
    raise exception 'Cannot post empty invoice.';
  end if;

  if v_inv.customer_id is not null then
    v_party_type := 'customer';
    v_party_id := v_inv.customer_id;
  elsif v_inv.vendor_id is not null then
    v_party_type := 'vendor';
    v_party_id := v_inv.vendor_id;
  else
    v_party_type := null;
    v_party_id := null;
  end if;

  v_entry_no := 'JE-' || v_inv.invoice_no;

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    v_inv.invoice_date,
    coalesce(v_inv.description, 'مرحّل من فاتورة ' || v_inv.invoice_no),
    'posted',
    'invoice',
    p_invoice_id,
    v_inv.branch_id
  )
  returning id into v_je_id;

  -- أسطر الحسابات الإضافية
  for v_row in
    select * from public.invoice_account_lines ial
    where ial.invoice_id = p_invoice_id
    order by ial.line_no
  loop
    perform public._invoice_add_journal_line(
      v_je_id,
      v_row.account_id,
      case when v_row.side = 'debit' then v_row.amount else 0 end,
      case when v_row.side = 'credit' then v_row.amount else 0 end,
      coalesce(v_row.description, 'حساب إضافي — فاتورة ' || v_inv.invoice_no),
      v_row.cost_center_id,
      v_row.branch_id,
      v_inv.currency_id,
      v_rate,
      null, null, null, null,
      p_invoice_id,
      v_row.id
    );
  end loop;

  v_discount_acct := coalesce(v_inv.discount_account_id, v_pat.default_discount_account_id);
  v_extra_acct := coalesce(v_inv.extra_account_id, v_pat.default_extra_account_id);

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0 and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      if v_line_disc > 0 or v_line_extra > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        if v_line_disc > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_discount_acct, v_line_disc, 0,
            'خصم سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        if v_line_extra > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_extra_acct, 0, v_line_extra,
            'إضافي سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );

        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        if v_line_cost > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_cost, v_line_cost, 0,
            'تكلفة مبيعات', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
          perform public._invoice_add_journal_line(
            v_je_id, v_inventory, 0, v_line_cost,
            'مخزون', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
        end if;
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'purchase' then
    if v_creditor is null then
      raise exception 'Purchase invoice requires creditor account (payable/cash).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        v_line_disc
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory,
          v_line_cost,
          0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor,
          v_line_cost,
          0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      -- خصم منفصل فقط عندما لا يدخل في تكلفة المخزون (نفس منطق الإضافي)
      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_extra > 0 and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_extra_acct, v_line_extra, 0,
          'إضافي سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, 0, v_row.line_amount,
        case when v_inv.settlement_mode = 'credit' then 'ذمم مورد' else 'نقدي' end,
        coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
        p_invoice_id, v_row.id
      );

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'transfer_out' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Transfer out (perpetual) requires inventory account.';
        end if;
        if v_transit is null then
          raise exception 'Transfer out (perpetual) requires transit account on pattern/invoice.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, v_line_cost, 0,
          'بضاعة بالطريق — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون مصدر — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_out', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set status = 'dispatched', shipped_at = coalesce(shipped_at, now()), out_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'transfer_in' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_qty_recv := coalesce(v_row.qty_received, v_row.quantity);
      if v_qty_recv < 0 then
        raise exception 'qty_received cannot be negative.';
      end if;
      if v_qty_recv > v_row.quantity then
        raise exception 'qty_received cannot exceed ordered quantity.';
      end if;

      v_qty_base_recv := public.material_quantity_to_base(
        v_row.material_unit_id,
        v_qty_recv
      );

      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        0
      );
      if v_line_cost <= 0 then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
      end if;

      -- تناسب التكلفة مع الكمية المستلمة عند الاستلام الجزئي
      if v_row.quantity_base > 0
         and v_qty_base_recv is distinct from v_row.quantity_base then
        v_line_cost := round(
          (v_line_cost * v_qty_base_recv / v_row.quantity_base)::numeric,
          2
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null or v_transit is null then
          raise exception 'Transfer in (perpetual) requires inventory and transit accounts.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون هدف — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, 0, v_line_cost,
          'إغلاق بالطريق — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_qty_recv,
        v_qty_base_recv,
        case
          when v_qty_base_recv > 0 then round((v_line_cost / v_qty_base_recv)::numeric, 4)
          else v_row.purchase_price
        end,
        v_line_cost,
        'transfer_in', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set
        status = case
          when exists (
            select 1 from public.inventory_transfer_lines itl
            where itl.transfer_id = v_inv.inventory_transfer_id
              and itl.qty_received < itl.qty_shipped
              and itl.qty_shipped > 0
          ) then 'partially_received'
          else 'received'
        end,
        received_at = coalesce(received_at, now()),
        in_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'return_sale' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_row.line_amount, 0,
        'مرتجع مبيعات', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_row.line_amount,
        'ذمم عميل — مرتجع', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
        p_invoice_id, v_row.id
      );

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_cost, 0, v_line_cost,
          'تكلفة — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'return_sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'return_purchase' then
    if v_creditor is null then
      raise exception 'Return purchase requires creditor account (payable).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Return purchase (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Return purchase (periodic) requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, 0, v_row.line_amount,
          'مشتريات — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'return_purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'opening_stock' then
    if v_creditor is null then
      raise exception 'Opening stock requires creditor account (opening equity / counterpart).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        round((v_row.quantity * v_row.unit_price)::numeric, 2),
        coalesce(v_row.discount_amount, 0)
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_line_cost, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'opening_stock', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  else
    raise exception 'Unsupported commercial_kind: %', v_pat.commercial_kind;
  end case;

  -- خصم الفاتورة + تدوير الإجمالي (§9 / §التخفيض)
  if coalesce(v_inv.invoice_discount_percent, 0) > 0 then
    v_invoice_disc := round((v_material_total * v_inv.invoice_discount_percent / 100)::numeric, 2);
  elsif coalesce(v_inv.invoice_discount_amount, 0) > 0 then
    v_invoice_disc := v_inv.invoice_discount_amount;
  end if;

  if v_invoice_disc > 0 then
    if v_discount_acct is null then
      raise exception 'Invoice discount requires discount_account_id on invoice or pattern.';
    end if;
    case v_pat.commercial_kind
    when 'sale' then
      if v_debtor is null then
        raise exception 'Sale discount requires debtor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, v_invoice_disc, 0,
        'خصم فاتورة — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_invoice_disc,
        'تخفيض ذمم — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
    when 'purchase' then
      if v_creditor is null then
        raise exception 'Purchase discount requires creditor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_invoice_disc, 0,
        'خصم مشتريات — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, 0, v_invoice_disc,
        'خصم مكتسب — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
    else
      null;
    end case;
  end if;

  if v_pat.rounding_enabled
     and coalesce(v_pat.rounding_target, 'invoice_total') in ('invoice_total', 'both')
     and v_pat.commercial_kind in ('sale', 'purchase') then
    v_round_step := coalesce(nullif(v_pat.rounding_step, 0), 1);
    v_party_total := v_material_total - v_invoice_disc;
    v_rounded_total := case coalesce(v_pat.rounding_mode, 'nearest')
      when 'up' then ceil(v_party_total / v_round_step - 0.0000001) * v_round_step
      when 'down' then floor(v_party_total / v_round_step + 0.0000001) * v_round_step
      else round(v_party_total / v_round_step) * v_round_step
    end;
    v_rounding_diff := round((v_rounded_total - v_party_total)::numeric, 2);

    if v_rounding_diff <> 0 then
      case v_pat.commercial_kind
      when 'sale' then
        if v_debtor is null then
          raise exception 'Sale rounding requires debtor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, v_rounding_diff, 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, 0, abs(v_rounding_diff),
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      when 'purchase' then
        if v_creditor is null then
          raise exception 'Purchase rounding requires creditor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, 0, v_rounding_diff,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, abs(v_rounding_diff), 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      else
        null;
      end case;
    end if;
  end if;

  -- توازن القيد
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_je_debit, v_je_credit
  from public.journal_entry_lines
  where journal_entry_id = v_je_id;

  if v_je_debit <> v_je_credit then
    raise exception 'Posted invoice journal is unbalanced: debit (%) <> credit (%).', v_je_debit, v_je_credit;
  end if;

  if v_has_materials then
    perform public.lock_company_inventory_foundation(v_inv.invoice_date::timestamptz);
  end if;

  update public.invoices
  set status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  where id = p_invoice_id;

  perform set_config('app.invoice_posting', 'false', true);

  return v_je_id;
exception
  when others then
    perform set_config('app.invoice_posting', 'false', true);
    raise;
end;
$$;


grant execute on function public.post_invoice(uuid) to authenticated;

-- =============================================================================
-- BEGIN patch_audit_governance_security.sql
-- =============================================================================
-- =============================================================================
-- patch_audit_governance_security.sql (#40)
-- =============================================================================
-- تدقيق: قيد افتتاحي بدون فرع + RLS فترات/فروع + invoice_reference_links
-- يتطلب: patch_invoice_pricing_cost.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) قيد افتتاحي مرحّل واحد per (فرع أو بدون فرع، سنة)
--    الفهرس السابق استثنى branch_id is null — ثغرة تكرار للشركات بدون فروع
-- ---------------------------------------------------------------------------

drop index if exists public.idx_vouchers_opening_per_branch_year;

create unique index if not exists idx_vouchers_opening_per_branch_year
  on public.vouchers (
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    (extract(year from voucher_date)::int)
  )
  where is_opening_entry = true
    and status = 'posted';

comment on index public.idx_vouchers_opening_per_branch_year is
  'قيد افتتاحي مرحّل واحد per سنة — يشمل branch_id null عبر coalesce (نفس نمط الفترات المحاسبية)';

-- ---------------------------------------------------------------------------
-- 2) accounting_periods — تقييد الكتابة بصلاحية إعدادات الشركة
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3) branches — نفس معيار company_settlement_accounts
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 4) invoice_reference_links — تفعيل RLS (كان الجدول بدون حماية)
-- ---------------------------------------------------------------------------

alter table public.invoice_reference_links enable row level security;

drop policy if exists "invoice_reference_links_all" on public.invoice_reference_links;
create policy "invoice_reference_links_all" on public.invoice_reference_links
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- BEGIN patch_revoke_anon_table_access.sql
-- =============================================================================
-- =============================================================================
-- patch_revoke_anon_table_access.sql (#41)
-- =============================================================================
-- أمني حرج: إزالة دور anon من سياسات RLS على الجداول المحاسبية.
-- الاستثناء الوحيد: SELECT على company_settings (شعار/اسم الشركة بصفحة الدخول).
-- storage company-assets يبقى قراءة عامة كما في 06_storage.sql.
--
-- شغّل هذا الملف على قواعد موجودة (إنتاج) حتى لو كان setup_all محدّثاً
-- لأن السياسات القديمة بـ anon تبقى حتى تُعاد كتابتها.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) إلغاء صلاحيات الجدول المباشرة من anon
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- صفحة الدخول تحتاج قراءة إعدادات الشركة فقط
grant select on public.company_settings to anon;

-- ---------------------------------------------------------------------------
-- 2) إعادة كتابة أي سياسة RLS ما زالت تمنح anon (ما عدا company_settings SELECT)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_cmd text;
  v_perm text;
  v_sql text;
begin
  for r in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and roles @> array['anon']::name[]
  loop
    if r.tablename = 'company_settings' and upper(r.cmd) = 'SELECT' then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );

    v_cmd := case upper(r.cmd)
      when '*' then 'ALL'
      else upper(r.cmd)
    end;

    v_perm := case
      when r.permissive = 'RESTRICTIVE' then 'RESTRICTIVE'
      else 'PERMISSIVE'
    end;

    if v_cmd = 'INSERT' then
      v_sql := format(
        'create policy %I on %I.%I as %s for insert to authenticated with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.with_check, 'true')
      );
    elsif v_cmd = 'SELECT' then
      v_sql := format(
        'create policy %I on %I.%I as %s for select to authenticated using (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true')
      );
    elsif v_cmd = 'DELETE' then
      v_sql := format(
        'create policy %I on %I.%I as %s for delete to authenticated using (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true')
      );
    elsif v_cmd = 'UPDATE' then
      v_sql := format(
        'create policy %I on %I.%I as %s for update to authenticated using (%s) with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true'),
        coalesce(r.with_check, coalesce(r.qual, 'true'))
      );
    else
      -- ALL
      v_sql := format(
        'create policy %I on %I.%I as %s for all to authenticated using (%s) with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true'),
        coalesce(r.with_check, coalesce(r.qual, 'true'))
      );
    end if;

    execute v_sql;
  end loop;
end;
$$;

-- تأكيد استثناء صفحة الدخول
drop policy if exists "company_settings_select" on public.company_settings;
create policy "company_settings_select" on public.company_settings
  for select to authenticated, anon
  using (true);

-- =============================================================================
-- BEGIN patch_create_material_with_base_unit.sql
-- =============================================================================
-- =============================================================================
-- patch_create_material_with_base_unit.sql (#42)
-- =============================================================================
-- إنشاء مادة + وحدة الأساس في معاملة واحدة (يمنع مادة بدون وحدة).
-- يتطلب: patch_materials_item_card.sql / patch_materials_tracking.sql
-- =============================================================================

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
begin
  if coalesce(nullif(trim(p_material->>'material_code'), ''), '') = '' then
    raise exception 'material_code is required.';
  end if;
  if coalesce(nullif(trim(p_material->>'name_ar'), ''), '') = '' then
    raise exception 'name_ar is required.';
  end if;

  v_unit_code := upper(trim(coalesce(p_base_unit->>'unit_code', '')));
  v_unit_name := trim(coalesce(p_base_unit->>'name_ar', ''));
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
    require_serial_on_outbound
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
    coalesce((p_material->>'require_serial_on_outbound')::boolean, false)
  )
  returning id into v_material_id;

  insert into public.material_units (
    material_id,
    unit_code,
    name_ar,
    name_en,
    is_base_unit,
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
    v_unit_code,
    v_unit_name,
    nullif(trim(coalesce(p_base_unit->>'name_en', '')), ''),
    true,
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

comment on function public.create_material_with_base_unit(jsonb, jsonb) is
  'إنشاء مادة مع وحدة الأساس ذرّياً — يمنع مادة بدون وحدة قياس';

grant execute on function public.create_material_with_base_unit(jsonb, jsonb)
  to authenticated;

-- مساعد: مواد بدون وحدة أساس (للواجهة والتقارير)
create or replace function public.list_material_ids_missing_base_unit()
returns table (material_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.materials m
  where not exists (
    select 1
    from public.material_units mu
    where mu.material_id = m.id
      and mu.is_base_unit = true
  );
$$;

grant execute on function public.list_material_ids_missing_base_unit()
  to authenticated;

-- =============================================================================
-- BEGIN patch_materials_card_v2.sql
-- =============================================================================
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
create or replace function public.calc_outbound_line_total_cost_normal(
  p_pricing_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of date
)
returns numeric
language plpgsql
stable
as $$
begin
  return round((
    abs(coalesce(p_quantity_base, 0))
    * public.calc_outbound_unit_cost(
      p_pricing_consumed_mode,
      p_settings,
      p_purchase_price,
      p_line_unit_price,
      p_factor_to_base,
      p_material_id,
      p_warehouse_id,
      p_cost_center_id,
      p_expiry_date,
      p_serial_number,
      p_as_of
    )
  )::numeric, 2);
end;
$$;

create or replace function public.calc_outbound_line_total_cost(
  p_pricing_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of date
)
returns numeric
language plpgsql
stable
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
        p_pricing_consumed_mode,
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
        p_as_of
      );
    end loop;
    return round(v_total::numeric, 2);
  end if;

  return public.calc_outbound_line_total_cost_normal(
    p_pricing_consumed_mode,
    p_settings,
    p_purchase_price,
    p_line_unit_price,
    p_factor_to_base,
    p_quantity_base,
    p_material_id,
    p_warehouse_id,
    p_cost_center_id,
    p_expiry_date,
    p_serial_number,
    p_as_of
  );
end;
$$;

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

-- =============================================================================
-- 06_storage.sql — Supabase Storage (شعار الشركة + مرفقات السندات مستقبلاً)
-- =============================================================================
-- شغّل بعد 05_permissions.sql (أو بعد setup_all.sql) على قاعدة موجودة.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voucher-attachments',
  'voucher-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- company-assets — شعار الشركة (قراءة عامة لصفحة الدخول)
-- ---------------------------------------------------------------------------

drop policy if exists "company_assets_public_read" on storage.objects;
create policy "company_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'company-assets');

drop policy if exists "company_assets_insert" on storage.objects;
create policy "company_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

drop policy if exists "company_assets_update" on storage.objects;
create policy "company_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

drop policy if exists "company_assets_delete" on storage.objects;
create policy "company_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

-- ---------------------------------------------------------------------------
-- voucher-attachments — جاهز لمرفقات السندات (قراءة للمصادقين فقط)
-- ---------------------------------------------------------------------------

drop policy if exists "voucher_attachments_select" on storage.objects;
create policy "voucher_attachments_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (
      public.is_admin()
      or public.has_permission('vouchers.view')
    )
  );

drop policy if exists "voucher_attachments_insert" on storage.objects;
create policy "voucher_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );

drop policy if exists "voucher_attachments_update" on storage.objects;
create policy "voucher_attachments_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );

drop policy if exists "voucher_attachments_delete" on storage.objects;
create policy "voucher_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );

-- =============================================================================
-- اكتمل التثبيت
-- =============================================================================
-- 1. Supabase → Authentication → Providers → فعّل Email/Password
-- 2. متغيرات البيئة للتطبيق:
--      NEXT_PUBLIC_SUPABASE_URL
--      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
--    (اختياري للإنشاء من الواجهة) SUPABASE_SERVICE_ROLE_KEY
-- 3. افتح التطبيق → /login → سجّل أول مستخدم (يصبح admin تلقائياً)
-- 4. من /settings/users أدر المستخدمين، ومن /settings/permissions الصلاحيات
-- 5. من /settings/branches و /settings/accounting-periods الإعدادات الجديدة
-- 6. (اختياري) شغّل 03_test_cases.sql للتحقق من سيناريوهات القبض والصرف
-- =============================================================================
