-- =============================================================================
-- setup_all.sql — إعداد كامل للتشغيل (ملف واحد)
-- =============================================================================
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor.
-- يدمج بالترتيب: 00_reset.sql + 01_schema.sql + 02_rls.sql
--
-- يشمل: المحاسبة، العملات، السندات، المصادقة (profiles)، الصلاحيات
--       (user_permissions / has_permission)، إعدادات الشركة والعملاء/الموردين.
--
-- ⚠️ تحذير: يحذف جميع البيانات السابقة ويعيد بناء المخطط من الصفر.
-- =============================================================================
-- =============================================================================
-- 00_reset.sql — إعادة ضبط كاملة للمخطط المحاسبي
-- =============================================================================
-- تحذير: يحذف جميع البيانات والجداول والدوال والمحفزات والعرض account_direct_balances.
-- استخدمه فقط عند إعادة التثبيت من الصفر (تطوير / بيئة اختبار).
-- =============================================================================

drop view if exists public.account_direct_balances cascade;

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
drop function if exists public.voucher_lines_prevent_delete_when_posted() cascade;
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
  line_description text null,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint journal_lines_single_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

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
  line_description text null,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  line_category_id uuid null references public.voucher_line_categories(id) on delete restrict,
  category_quantity numeric(18, 4) null check (category_quantity is null or category_quantity >= 0),
  created_at timestamptz not null default now()
);

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

-- ---------------------------------------------------------------------------
-- عرض الأرصدة المباشرة
-- ---------------------------------------------------------------------------

create or replace view public.account_direct_balances
with (security_invoker = true)
as
select
  jel.account_id,
  coalesce(sum(jel.debit), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit - jel.credit), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;

-- ---------------------------------------------------------------------------
-- دوال مساعدة
-- ---------------------------------------------------------------------------

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

grant execute on function public.peek_voucher_no(varchar) to anon, authenticated;
grant execute on function public.reserve_voucher_no(varchar) to anon, authenticated;

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
      raise exception 'Parent account must be non-postable.';
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
            then jel.debit - jel.credit
          else 0
        end
      ), 0)::numeric(18, 2) as opening_balance,
      coalesce(sum(
        case
          when (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.debit
          else 0
        end
      ), 0)::numeric(18, 2) as period_debit,
      coalesce(sum(
        case
          when (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.credit
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
    raise exception 'Posted voucher cannot be modified. Use reversal instead.';
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

  if v_voucher_status = 'posted' then
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

  if v_voucher_status = 'posted' then
    raise exception 'Posted voucher lines cannot be deleted.';
  end if;

  return old;
end;
$$;

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

  if v_voucher_status = 'posted' then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
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
begin
  if old.status = 'posted' then
    raise exception 'Posted voucher cannot be modified. Use reversal instead.';
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
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
      cost_center_id
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
      vl.cost_center_id
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;

create or replace function public.vouchers_prevent_delete_when_posted()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
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

create trigger trg_voucher_lines_prevent_delete_when_posted
before delete on public.voucher_lines
for each row execute function public.voucher_lines_prevent_delete_when_posted();

create trigger trg_voucher_allocations_validate_insert_update
before insert or update on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

create trigger trg_voucher_allocations_validate_delete
before delete on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

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

insert into public.voucher_line_categories (voucher_type, code, name_ar, requires_quantity, quantity_label, sort_order)
values
  ('payment', 'PAY-FOOD', 'اطعام', false, null, 10),
  ('payment', 'PAY-NUTR', 'تغذية', false, null, 20),
  ('payment', 'PAY-CONST', 'انشائية', true, 'العدد', 30);
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

-- currencies
drop policy if exists "currencies_select_all" on public.currencies;
create policy "currencies_select_all" on public.currencies
  for select to anon, authenticated using (true);
drop policy if exists "currencies_insert_all" on public.currencies;
create policy "currencies_insert_all" on public.currencies
  for insert to anon, authenticated with check (true);
drop policy if exists "currencies_update_all" on public.currencies;
create policy "currencies_update_all" on public.currencies
  for update to anon, authenticated using (true) with check (true);

-- currency_rate_history (قراءة فقط من الواجهة — الإدراج عبر دوال SQL)
drop policy if exists "currency_rate_history_select_all" on public.currency_rate_history;
create policy "currency_rate_history_select_all" on public.currency_rate_history
  for select to anon, authenticated using (true);
drop policy if exists "currency_rate_history_insert_all" on public.currency_rate_history;
create policy "currency_rate_history_insert_all" on public.currency_rate_history
  for insert to anon, authenticated with check (true);

-- accounts
drop policy if exists "accounts_select_all" on public.accounts;
create policy "accounts_select_all" on public.accounts
  for select to anon, authenticated using (true);
drop policy if exists "accounts_insert_all" on public.accounts;
create policy "accounts_insert_all" on public.accounts
  for insert to anon, authenticated with check (true);
drop policy if exists "accounts_update_all" on public.accounts;
create policy "accounts_update_all" on public.accounts
  for update to anon, authenticated using (true) with check (true);

-- cost_centers
drop policy if exists "cost_centers_select_all" on public.cost_centers;
create policy "cost_centers_select_all" on public.cost_centers
  for select to anon, authenticated using (true);
drop policy if exists "cost_centers_insert_all" on public.cost_centers;
create policy "cost_centers_insert_all" on public.cost_centers
  for insert to anon, authenticated with check (true);
drop policy if exists "cost_centers_update_all" on public.cost_centers;
create policy "cost_centers_update_all" on public.cost_centers
  for update to anon, authenticated using (true) with check (true);

-- journal_entries
drop policy if exists "journal_entries_select_all" on public.journal_entries;
create policy "journal_entries_select_all" on public.journal_entries
  for select to anon, authenticated using (true);
drop policy if exists "journal_entries_insert_all" on public.journal_entries;
create policy "journal_entries_insert_all" on public.journal_entries
  for insert to anon, authenticated with check (true);
drop policy if exists "journal_entries_update_all" on public.journal_entries;
create policy "journal_entries_update_all" on public.journal_entries
  for update to anon, authenticated using (true) with check (true);

-- journal_entry_lines
drop policy if exists "journal_entry_lines_select_all" on public.journal_entry_lines;
create policy "journal_entry_lines_select_all" on public.journal_entry_lines
  for select to anon, authenticated using (true);
drop policy if exists "journal_entry_lines_insert_all" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_all" on public.journal_entry_lines
  for insert to anon, authenticated with check (true);
drop policy if exists "journal_entry_lines_update_all" on public.journal_entry_lines;
create policy "journal_entry_lines_update_all" on public.journal_entry_lines
  for update to anon, authenticated using (true) with check (true);

-- customers
drop policy if exists "customers_select_all" on public.customers;
create policy "customers_select_all" on public.customers
  for select to anon, authenticated using (true);
drop policy if exists "customers_insert_all" on public.customers;
create policy "customers_insert_all" on public.customers
  for insert to anon, authenticated with check (true);
drop policy if exists "customers_update_all" on public.customers;
create policy "customers_update_all" on public.customers
  for update to anon, authenticated using (true) with check (true);

-- vendors
drop policy if exists "vendors_select_all" on public.vendors;
create policy "vendors_select_all" on public.vendors
  for select to anon, authenticated using (true);
drop policy if exists "vendors_insert_all" on public.vendors;
create policy "vendors_insert_all" on public.vendors
  for insert to anon, authenticated with check (true);
drop policy if exists "vendors_update_all" on public.vendors;
create policy "vendors_update_all" on public.vendors
  for update to anon, authenticated using (true) with check (true);

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
  for select to anon, authenticated using (true);
drop policy if exists "party_settings_insert_all" on public.party_settings;
create policy "party_settings_insert_all" on public.party_settings
  for insert to anon, authenticated with check (true);
drop policy if exists "party_settings_update_all" on public.party_settings;
create policy "party_settings_update_all" on public.party_settings
  for update to anon, authenticated using (true) with check (true);

-- voucher_settings
drop policy if exists "voucher_settings_select_all" on public.voucher_settings;
create policy "voucher_settings_select_all" on public.voucher_settings
  for select to anon, authenticated using (true);
drop policy if exists "voucher_settings_insert_all" on public.voucher_settings;
create policy "voucher_settings_insert_all" on public.voucher_settings
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_settings_update_all" on public.voucher_settings;
create policy "voucher_settings_update_all" on public.voucher_settings
  for update to anon, authenticated using (true) with check (true);

-- voucher_number_sequences
drop policy if exists "voucher_number_sequences_select_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_select_all" on public.voucher_number_sequences
  for select to anon, authenticated using (true);
drop policy if exists "voucher_number_sequences_insert_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_insert_all" on public.voucher_number_sequences
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_number_sequences_update_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_update_all" on public.voucher_number_sequences
  for update to anon, authenticated using (true) with check (true);

-- voucher_type_defaults
drop policy if exists "voucher_type_defaults_select_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_select_all" on public.voucher_type_defaults
  for select to anon, authenticated using (true);
drop policy if exists "voucher_type_defaults_insert_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_insert_all" on public.voucher_type_defaults
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_type_defaults_update_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_update_all" on public.voucher_type_defaults
  for update to anon, authenticated using (true) with check (true);

-- voucher_line_categories
drop policy if exists "voucher_line_categories_select_all" on public.voucher_line_categories;
create policy "voucher_line_categories_select_all" on public.voucher_line_categories
  for select to anon, authenticated using (true);
drop policy if exists "voucher_line_categories_insert_all" on public.voucher_line_categories;
create policy "voucher_line_categories_insert_all" on public.voucher_line_categories
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_line_categories_update_all" on public.voucher_line_categories;
create policy "voucher_line_categories_update_all" on public.voucher_line_categories
  for update to anon, authenticated using (true) with check (true);

-- vouchers
drop policy if exists "vouchers_select_all" on public.vouchers;
create policy "vouchers_select_all" on public.vouchers
  for select to anon, authenticated using (true);
drop policy if exists "vouchers_insert_all" on public.vouchers;
create policy "vouchers_insert_all" on public.vouchers
  for insert to anon, authenticated with check (true);
drop policy if exists "vouchers_update_all" on public.vouchers;
create policy "vouchers_update_all" on public.vouchers
  for update to anon, authenticated using (true) with check (true);

-- voucher_lines
drop policy if exists "voucher_lines_select_all" on public.voucher_lines;
create policy "voucher_lines_select_all" on public.voucher_lines
  for select to anon, authenticated using (true);
drop policy if exists "voucher_lines_insert_all" on public.voucher_lines;
create policy "voucher_lines_insert_all" on public.voucher_lines
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_lines_update_all" on public.voucher_lines;
create policy "voucher_lines_update_all" on public.voucher_lines
  for update to anon, authenticated using (true) with check (true);

-- voucher_allocations
drop policy if exists "voucher_allocations_select_all" on public.voucher_allocations;
create policy "voucher_allocations_select_all" on public.voucher_allocations
  for select to anon, authenticated using (true);
drop policy if exists "voucher_allocations_insert_all" on public.voucher_allocations;
create policy "voucher_allocations_insert_all" on public.voucher_allocations
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_allocations_update_all" on public.voucher_allocations;
create policy "voucher_allocations_update_all" on public.voucher_allocations
  for update to anon, authenticated using (true) with check (true);

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
-- 06_storage.sql — Supabase Storage
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

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'voucher-attachments',
  'voucher-attachments',
  false,
  10485760
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

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
-- 5. من /settings/company ارفع شعار الشركة وعدّل بياناتها
-- 6. من /vouchers/settings حدّد الحسابات الافتراضية
-- 7. (اختياري) شغّل 03_test_cases.sql للتحقق من سيناريوهات القبض والصرف
-- =============================================================================