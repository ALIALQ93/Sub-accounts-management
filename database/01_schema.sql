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

insert into public.accounts (code, name_ar, parent_id, currency_id, level, is_postable, is_active)
values
  ('1', 'الموجودات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('2', 'الالتزامات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('3', 'حقوق الملكية', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('4', 'المبيعات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('5', 'المشتريات', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('6', 'المصاريف', null, (select id from public.currencies where code = 'IQD'), 1, false, true),
  ('7', 'الايرادات', null, (select id from public.currencies where code = 'IQD'), 1, false, true);

insert into public.cost_centers (code, name_ar, name_en)
values
  ('CC-000', 'عام', 'General'),
  ('CC-100', 'المبيعات', 'Sales'),
  ('CC-200', 'الإدارة', 'Administration');

insert into public.voucher_settings (id)
values (1);

insert into public.voucher_number_sequences (voucher_type, prefix, padding, include_year)
values
  ('receipt', 'RCP', 4, true),
  ('payment', 'PAY', 4, true),
  ('settlement', 'SET', 4, true);

insert into public.voucher_type_defaults (voucher_type, default_currency_id, default_cost_center_id)
select 'receipt', c.id, cc.id
from public.currencies c
cross join public.cost_centers cc
where c.is_base = true and cc.code = 'CC-000';

insert into public.voucher_type_defaults (voucher_type, default_currency_id, default_cost_center_id)
select 'payment', c.id, cc.id
from public.currencies c
cross join public.cost_centers cc
where c.is_base = true and cc.code = 'CC-000';

insert into public.voucher_type_defaults (voucher_type, default_currency_id, default_cost_center_id)
select 'settlement', c.id, cc.id
from public.currencies c
cross join public.cost_centers cc
where c.is_base = true and cc.code = 'CC-000';

insert into public.voucher_line_categories (voucher_type, code, name_ar, requires_quantity, quantity_label, sort_order)
values
  ('payment', 'PAY-FOOD', 'اطعام', false, null, 10),
  ('payment', 'PAY-NUTR', 'تغذية', false, null, 20),
  ('payment', 'PAY-CONST', 'انشائية', true, 'العدد', 30);
