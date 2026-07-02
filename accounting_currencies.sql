-- Currencies module + link to accounts
-- Run in Supabase SQL Editor after accounting_schema.sql

create table if not exists public.currencies (
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

create unique index if not exists idx_currencies_single_base
  on public.currencies (is_base)
  where is_base = true;

create index if not exists idx_currencies_active on public.currencies(is_active);

-- Seed core currencies (IQD = base). Rates are editable by the user.
insert into public.currencies (code, name_ar, name_en, symbol, exchange_rate, decimal_places, is_base, is_active)
values
  ('IQD', 'دينار عراقي', 'Iraqi Dinar', 'د.ع', 1, 0, true, true),
  ('USD', 'دولار أمريكي', 'US Dollar', '$', 1310, 2, false, false),
  ('EUR', 'يورو', 'Euro', '€', 1420, 2, false, false),
  ('SYP', 'ليرة سورية', 'Syrian Pound', 'ل.س', 0.105, 0, false, false),
  ('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', 357, 2, false, false)
on conflict (code) do nothing;

alter table public.accounts
  add column if not exists currency_id uuid null references public.currencies(id) on delete restrict;

-- Assign IQD to existing accounts without currency
update public.accounts a
set currency_id = c.id
from public.currencies c
where c.code = 'IQD'
  and a.currency_id is null;

create index if not exists idx_accounts_currency_id on public.accounts(currency_id);

-- View: direct posted balances per account (in account currency)
create or replace view public.account_direct_balances as
select
  jel.account_id,
  coalesce(sum(jel.debit), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit - jel.credit), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;

drop trigger if exists trg_currencies_updated_at on public.currencies;
create trigger trg_currencies_updated_at
before update on public.currencies
for each row execute function public.set_updated_at();

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

drop trigger if exists trg_currencies_validate_base on public.currencies;
create trigger trg_currencies_validate_base
before insert or update on public.currencies
for each row execute function public.currencies_validate_base_rate();

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

drop trigger if exists trg_currencies_prevent_deactivate_base on public.currencies;
create trigger trg_currencies_prevent_deactivate_base
before update on public.currencies
for each row execute function public.currencies_prevent_deactivate_base();
