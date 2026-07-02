-- Accounting core schema for Supabase/PostgreSQL.
-- Focused on chart-of-accounts business rules discussed in chat.

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  parent_id uuid null references public.accounts(id) on delete restrict,
  level int not null default 1 check (level >= 1),
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_parent_not_self check (id is null or id <> parent_id)
);

create index if not exists idx_accounts_parent_id on public.accounts(parent_id);
create index if not exists idx_accounts_code on public.accounts(code);

create table if not exists public.journal_entries (
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

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  line_description text null,
  created_at timestamptz not null default now(),
  constraint journal_lines_single_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index if not exists idx_journal_lines_entry_id on public.journal_entry_lines(journal_entry_id);
create index if not exists idx_journal_lines_account_id on public.journal_entry_lines(account_id);

create table if not exists public.customers (
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

create index if not exists idx_customers_receivable_account_id on public.customers(receivable_account_id);

create table if not exists public.vendors (
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

create index if not exists idx_vendors_payable_account_id on public.vendors(payable_account_id);

create table if not exists public.vouchers (
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

create index if not exists idx_vouchers_status on public.vouchers(status);
create index if not exists idx_vouchers_type on public.vouchers(voucher_type);
create index if not exists idx_vouchers_date on public.vouchers(voucher_date);
create index if not exists idx_vouchers_customer_id on public.vouchers(customer_id);
create index if not exists idx_vouchers_vendor_id on public.vouchers(vendor_id);

create table if not exists public.voucher_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  side varchar(10) not null check (side in ('debit', 'credit')),
  amount numeric(18, 2) not null check (amount > 0),
  line_description text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_voucher_lines_voucher_id on public.voucher_lines(voucher_id);
create index if not exists idx_voucher_lines_account_id on public.voucher_lines(account_id);

create table if not exists public.voucher_allocations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  target_journal_line_id uuid not null references public.journal_entry_lines(id) on delete restrict,
  applied_amount numeric(18, 2) not null check (applied_amount > 0),
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_voucher_allocations_voucher_id on public.voucher_allocations(voucher_id);
create index if not exists idx_voucher_allocations_target_line_id on public.voucher_allocations(target_journal_line_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_journal_entries_updated_at on public.journal_entries;
create trigger trg_journal_entries_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

drop trigger if exists trg_vouchers_updated_at on public.vouchers;
create trigger trg_vouchers_updated_at
before update on public.vouchers
for each row execute function public.set_updated_at();

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

    -- Prevent circular hierarchy: new.parent_id cannot be a descendant of new.id.
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

    new.level = coalesce((select level + 1 from public.accounts where id = new.parent_id), 1);
  else
    new.level = 1;
  end if;

  -- A parent account cannot be postable.
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

drop trigger if exists trg_accounts_hierarchy_rules on public.accounts;
create trigger trg_accounts_hierarchy_rules
before insert or update on public.accounts
for each row execute function public.accounts_apply_hierarchy_rules();

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

drop trigger if exists trg_accounts_child_insert_parent_non_postable on public.accounts;
create trigger trg_accounts_child_insert_parent_non_postable
after insert on public.accounts
for each row execute function public.accounts_on_child_insert_make_parent_non_postable();

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

drop trigger if exists trg_accounts_prevent_delete_when_used on public.accounts;
create trigger trg_accounts_prevent_delete_when_used
before delete on public.accounts
for each row execute function public.prevent_account_delete_when_used();

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

drop trigger if exists trg_journal_lines_validate_account on public.journal_entry_lines;
create trigger trg_journal_lines_validate_account
before insert or update on public.journal_entry_lines
for each row execute function public.journal_lines_validate_account_is_postable();

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

drop trigger if exists trg_journal_entry_validate_balance on public.journal_entries;
create trigger trg_journal_entry_validate_balance
before update on public.journal_entries
for each row execute function public.journal_entry_validate_balance_before_post();

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

drop trigger if exists trg_customers_validate_accounts on public.customers;
create trigger trg_customers_validate_accounts
before insert or update on public.customers
for each row execute function public.customers_vendors_validate_accounts();

drop trigger if exists trg_vendors_validate_accounts on public.vendors;
create trigger trg_vendors_validate_accounts
before insert or update on public.vendors
for each row execute function public.customers_vendors_validate_accounts();

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

drop trigger if exists trg_vouchers_validate_parties on public.vouchers;
create trigger trg_vouchers_validate_parties
before insert or update on public.vouchers
for each row execute function public.vouchers_validate_parties();

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

drop trigger if exists trg_voucher_lines_validate_account on public.voucher_lines;
create trigger trg_voucher_lines_validate_account
before insert or update on public.voucher_lines
for each row execute function public.voucher_lines_validate_account_is_postable();

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

drop trigger if exists trg_voucher_lines_prevent_delete_when_posted on public.voucher_lines;
create trigger trg_voucher_lines_prevent_delete_when_posted
before delete on public.voucher_lines
for each row execute function public.voucher_lines_prevent_delete_when_posted();

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

drop trigger if exists trg_voucher_allocations_validate_insert_update on public.voucher_allocations;
create trigger trg_voucher_allocations_validate_insert_update
before insert or update on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

drop trigger if exists trg_voucher_allocations_validate_delete on public.voucher_allocations;
create trigger trg_voucher_allocations_validate_delete
before delete on public.voucher_allocations
for each row execute function public.voucher_allocations_validate();

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
      line_description
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      vl.line_description
    from public.voucher_lines vl
    where vl.voucher_id = new.id;

    new.journal_entry_id = v_je_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vouchers_before_update_handle_posting on public.vouchers;
create trigger trg_vouchers_before_update_handle_posting
before update on public.vouchers
for each row execute function public.vouchers_before_update_handle_posting();

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

drop trigger if exists trg_vouchers_prevent_delete_when_posted on public.vouchers;
create trigger trg_vouchers_prevent_delete_when_posted
before delete on public.vouchers
for each row execute function public.vouchers_prevent_delete_when_posted();

-- Seed the 7 root accounts.
insert into public.accounts (code, name_ar, parent_id, level, is_postable, is_active)
values
  ('1', 'الموجودات', null, 1, false, true),
  ('2', 'الالتزامات', null, 1, false, true),
  ('3', 'حقوق الملكية', null, 1, false, true),
  ('4', 'المبيعات', null, 1, false, true),
  ('5', 'المشتريات', null, 1, false, true),
  ('6', 'المصاريف', null, 1, false, true),
  ('7', 'الايرادات', null, 1, false, true)
on conflict (code) do nothing;
