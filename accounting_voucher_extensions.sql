-- Voucher extensions: cost centers, type defaults, currency & cost center on vouchers
-- Run after accounting_schema.sql and accounting_currencies.sql

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cost_centers_active on public.cost_centers(is_active);

insert into public.cost_centers (code, name_ar, name_en)
values
  ('CC-000', 'عام', 'General'),
  ('CC-100', 'المبيعات', 'Sales'),
  ('CC-200', 'الإدارة', 'Administration')
on conflict (code) do nothing;

create table if not exists public.voucher_type_defaults (
  voucher_type varchar(20) primary key
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  default_account_id uuid null references public.accounts(id) on delete set null,
  default_currency_id uuid null references public.currencies(id) on delete set null,
  default_cost_center_id uuid null references public.cost_centers(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'receipt', c.id
from public.currencies c
where c.is_base = true
on conflict (voucher_type) do nothing;

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'payment', c.id
from public.currencies c
where c.is_base = true
on conflict (voucher_type) do nothing;

insert into public.voucher_type_defaults (voucher_type, default_currency_id)
select 'settlement', c.id
from public.currencies c
where c.is_base = true
on conflict (voucher_type) do nothing;

alter table public.vouchers
  add column if not exists currency_id uuid null references public.currencies(id) on delete restrict,
  add column if not exists cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  add column if not exists exchange_rate numeric(18, 6) null check (exchange_rate is null or exchange_rate > 0);

alter table public.voucher_lines
  add column if not exists cost_center_id uuid null references public.cost_centers(id) on delete restrict;

-- Default existing vouchers to base currency
update public.vouchers v
set currency_id = c.id
from public.currencies c
where v.currency_id is null and c.is_base = true;

drop trigger if exists trg_cost_centers_updated_at on public.cost_centers;
create trigger trg_cost_centers_updated_at
before update on public.cost_centers
for each row execute function public.set_updated_at();

drop trigger if exists trg_voucher_type_defaults_updated_at on public.voucher_type_defaults;
create trigger trg_voucher_type_defaults_updated_at
before update on public.voucher_type_defaults
for each row execute function public.set_updated_at();
